/**
 * Appointment Confirmation Worker
 *
 * Processes SendAppointmentConfirmationJob:
 * 1. Sends SMS confirmation to the caller
 * 2. Sends email notification to the CRM user (recipient)
 * 3. Creates a CRM Activity of type "meeting"
 * 4. Updates appointment + session + missed call log statuses
 * 5. Emits call:scheduled hook
 */
import { Worker } from "bullmq";
import { createDecipheriv } from "crypto";
import * as React from "react";
import { db } from "@synccorehub/database/client";
import {
  scheduledAppointments,
  schedulingSessions,
  missedCallLogs,
  callRoutingNumbers,
  pluginConfigs,
  installedPlugins,
  plugins,
  activities,
  user,
} from "@synccorehub/database/schema";
import { and, eq } from "drizzle-orm";
import { eventBus } from "@synccorehub/plugins/hooks";
import { sendEmail } from "@synccorehub/email";
import { AppointmentConfirmationEmail } from "@synccorehub/email";
import { connection } from "../queues/index.js";
import type { SendAppointmentConfirmationJob } from "../types.js";

const ENCRYPTION_KEY = Buffer.from(
  process.env.ENCRYPTION_KEY ?? "0".repeat(64),
  "hex"
);

function decryptValue(ciphertext: string): string {
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

async function getPluginConfig(tenantId: string): Promise<Record<string, string>> {
  const rows = await db
    .select({
      key: pluginConfigs.key,
      encryptedValue: pluginConfigs.encryptedValue,
      plaintextValue: pluginConfigs.plaintextValue,
      isSecret: pluginConfigs.isSecret,
    })
    .from(pluginConfigs)
    .innerJoin(installedPlugins, eq(pluginConfigs.installedPluginId, installedPlugins.id))
    .innerJoin(plugins, eq(installedPlugins.pluginId, plugins.id))
    .where(and(eq(pluginConfigs.tenantId, tenantId), eq(plugins.slug, "smart-call-routing")));

  return Object.fromEntries(
    rows.map((r) => [
      r.key,
      r.isSecret && r.encryptedValue ? decryptValue(r.encryptedValue) : r.plaintextValue ?? "",
    ])
  );
}

function formatAppointmentTime(isoDate: string, timezone: string): string {
  return new Date(isoDate).toLocaleString("en-US", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function createAppointmentConfirmationWorker() {
  const worker = new Worker<SendAppointmentConfirmationJob>(
    "appointment-confirmation",
    async (job) => {
      const { tenantId, appointmentId, scheduledAt, recipientUserId, callerPhone, callerName } =
        job.data;

      console.log(`[appointment-confirmation] Processing appointment ${appointmentId}`);

      // Fetch appointment + session + virtual number in one pass
      const [appt] = await db
        .select({
          appointment: scheduledAppointments,
          session: schedulingSessions,
          number: callRoutingNumbers,
        })
        .from(scheduledAppointments)
        .innerJoin(
          schedulingSessions,
          eq(scheduledAppointments.schedulingSessionId, schedulingSessions.id)
        )
        .innerJoin(
          callRoutingNumbers,
          eq(scheduledAppointments.virtualNumberId, callRoutingNumbers.id)
        )
        .where(eq(scheduledAppointments.id, appointmentId))
        .limit(1);

      if (!appt) {
        console.error(`[appointment-confirmation] Appointment ${appointmentId} not found`);
        return;
      }

      const { appointment, session, number } = appt;
      const config = await getPluginConfig(tenantId);

      // Fetch recipient user
      const [recipient] = await db
        .select({ name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, recipientUserId))
        .limit(1);

      const timezone =
        (number.availabilityConfig as { timezone?: string } | null)?.timezone ??
        "America/New_York";
      const formattedTime = formatAppointmentTime(scheduledAt, timezone);

      // 1. Send SMS to caller
      if (config.twilioAccountSid && config.twilioAuthToken) {
        try {
          const twilio = (await import("twilio")).default;
          const client = twilio(config.twilioAccountSid, config.twilioAuthToken);

          const callerGreeting = callerName ? `Hi ${callerName}!` : "Hi!";
          const smsBody = `${callerGreeting} Your appointment is confirmed for ${formattedTime}. We'll call you at ${callerPhone}. Reply CANCEL to cancel.`;

          const msgOptions: Parameters<typeof client.messages.create>[0] = {
            to: callerPhone,
            body: smsBody,
          };
          if (config.twilioMessagingServiceSid) {
            msgOptions.messagingServiceSid = config.twilioMessagingServiceSid;
          } else {
            msgOptions.from = number.phoneNumber;
          }

          await client.messages.create(msgOptions);
          console.log(`[appointment-confirmation] SMS sent to caller ${callerPhone}`);
        } catch (err) {
          console.error("[appointment-confirmation] SMS send failed:", err);
          // Don't throw — continue with other steps
        }
      }

      // 2. Send email to recipient
      if (recipient?.email) {
        try {
          await sendEmail({
            to: recipient.email,
            subject: `Appointment confirmed: ${callerName ?? callerPhone} on ${new Date(scheduledAt).toLocaleDateString("en-US", { timeZone: timezone, month: "short", day: "numeric" })}`,
            react: React.createElement(AppointmentConfirmationEmail, {
              recipientName: recipient.name ?? "there",
              callerName: callerName ?? null,
              callerPhone,
              scheduledAt: formattedTime,
              appointmentId,
            }),
          });
          console.log(`[appointment-confirmation] Email sent to ${recipient.email}`);
        } catch (err) {
          console.error("[appointment-confirmation] Email send failed:", err);
        }
      }

      // 3. Create CRM Activity (type: meeting)
      const activityTitle = `Scheduled callback${callerName ? ` with ${callerName}` : ""}`;
      const [activity] = await db
        .insert(activities)
        .values({
          tenantId,
          type: "meeting",
          title: activityTitle,
          content: `Caller: ${callerName ?? "Unknown"}\nPhone: ${callerPhone}\nScheduled: ${formattedTime}`,
          createdById: recipientUserId,
          occurredAt: new Date(scheduledAt),
          durationMinutes: appointment.durationMinutes,
          metadata: {
            callerPhone,
            callerName: callerName ?? null,
            appointmentId,
            schedulingSessionId: session.id,
            source: "smart-call-routing",
          },
        })
        .returning();

      // 4. Update appointment with activity ID
      if (activity) {
        await db
          .update(scheduledAppointments)
          .set({ activityId: activity.id, updatedAt: new Date() })
          .where(eq(scheduledAppointments.id, appointmentId));
      }

      // 5. Update session and missed call log
      await db
        .update(schedulingSessions)
        .set({ status: "scheduled", updatedAt: new Date() })
        .where(eq(schedulingSessions.id, session.id));

      await db
        .update(missedCallLogs)
        .set({ status: "scheduled" })
        .where(eq(missedCallLogs.id, session.missedCallLogId));

      // 6. Emit hook
      const [missedLog] = await db
        .select({ callSid: missedCallLogs.callSid })
        .from(missedCallLogs)
        .where(eq(missedCallLogs.id, session.missedCallLogId))
        .limit(1);

      await eventBus.emit("call:scheduled", {
        tenantId,
        callSid: missedLog?.callSid ?? "",
        appointmentId,
        schedulingSessionId: session.id,
        scheduledAt: new Date(scheduledAt).toISOString(),
        recipientUserId,
      });

      console.log(`[appointment-confirmation] Appointment ${appointmentId} fully processed`);
    },
    {
      connection,
      concurrency: 3,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(
      `[appointment-confirmation] Job ${job?.id} failed:`,
      err.message
    );
  });

  return worker;
}
