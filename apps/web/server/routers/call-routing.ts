import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../trpc";
import { db } from "@synccorehub/database/client";
import {
  callRoutingNumbers,
  missedCallLogs,
  scheduledAppointments,
  schedulingSessions,
  pluginConfigs,
  installedPlugins,
  plugins,
} from "@synccorehub/database/schema";
import { decryptValue, encryptValue } from "../lib/crypto";

// ── Helpers ────────────────────────────────────────────────────────────────

async function getPluginConfig(
  tenantId: string
): Promise<Record<string, string>> {
  const rows = await db
    .select({ key: pluginConfigs.key, encryptedValue: pluginConfigs.encryptedValue, plaintextValue: pluginConfigs.plaintextValue, isSecret: pluginConfigs.isSecret })
    .from(pluginConfigs)
    .innerJoin(installedPlugins, eq(pluginConfigs.installedPluginId, installedPlugins.id))
    .innerJoin(plugins, eq(installedPlugins.pluginId, plugins.id))
    .where(
      and(
        eq(pluginConfigs.tenantId, tenantId),
        eq(plugins.slug, "smart-call-routing")
      )
    );

  return Object.fromEntries(
    rows.map((r) => [
      r.key,
      r.isSecret && r.encryptedValue
        ? decryptValue(r.encryptedValue)
        : r.plaintextValue ?? "",
    ])
  );
}

// ── Availability config schema ─────────────────────────────────────────────
const availabilityConfigSchema = z.object({
  days: z.array(z.number().min(0).max(6)).default([1, 2, 3, 4, 5]),
  startHour: z.number().min(0).max(23).default(9),
  endHour: z.number().min(1).max(24).default(17),
  timezone: z.string().default("America/New_York"),
  slotDurationMinutes: z.number().default(30),
});

// ── Router ─────────────────────────────────────────────────────────────────
export const callRoutingRouter = router({
  // ── List virtual numbers for this tenant ───────────────────────────────
  getNumbers: tenantProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(callRoutingNumbers)
      .where(
        and(
          eq(callRoutingNumbers.tenantId, ctx.tenantId),
          eq(callRoutingNumbers.status, "active")
        )
      )
      .orderBy(callRoutingNumbers.createdAt);
  }),

  // ── Purchase a Twilio number and register it ───────────────────────────
  assignNumber: tenantProcedure
    .input(
      z.object({
        areaCode: z.string().length(3).optional(),
        label: z.string().optional(),
        forwardToNumber: z.string().optional(), // user's real phone in E.164
      })
    )
    .mutation(async ({ ctx, input }) => {
      const config = await getPluginConfig(ctx.tenantId);
      if (!config.twilioAccountSid || !config.twilioAuthToken) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Configure Twilio credentials in plugin settings first.",
        });
      }

      // Dynamic import to avoid loading Twilio when not needed
      const twilio = (await import("twilio")).default;
      const client = twilio(config.twilioAccountSid, config.twilioAuthToken);

      const appBaseUrl =
        config.schedulingPageBaseUrl || process.env.NEXT_PUBLIC_APP_URL || "";

      // Search for an available local number
      const searchParams: Record<string, unknown> = { limit: 1 };
      if (input.areaCode) searchParams.areaCode = input.areaCode;

      const available = await client
        .availablePhoneNumbers("US")
        .local.list(searchParams as never);

      if (!available.length) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `No available numbers found${input.areaCode ? ` for area code ${input.areaCode}` : ""}. Try a different area code.`,
        });
      }

      const chosenNumber = available[0]!;

      // Purchase the number and configure its webhooks
      const purchased = await client.incomingPhoneNumbers.create({
        phoneNumber: chosenNumber.phoneNumber,
        voiceUrl: `${appBaseUrl}/api/webhooks/twilio/voice`,
        voiceMethod: "POST",
        statusCallback: `${appBaseUrl}/api/webhooks/twilio/status`,
        statusCallbackMethod: "POST",
      });

      const [record] = await db
        .insert(callRoutingNumbers)
        .values({
          tenantId: ctx.tenantId,
          userId: ctx.userId,
          phoneNumber: purchased.phoneNumber,
          twilioSid: purchased.sid,
          label: input.label ?? null,
          forwardToNumber: input.forwardToNumber
            ? encryptValue(input.forwardToNumber)
            : null,
          status: "active",
          availabilityConfig: {
            days: [1, 2, 3, 4, 5],
            startHour: 9,
            endHour: 17,
            timezone: "America/New_York",
            slotDurationMinutes: 30,
          },
        })
        .returning();

      return record!;
    }),

  // ── Release a Twilio number ────────────────────────────────────────────
  releaseNumber: tenantProcedure
    .input(z.object({ numberId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [number] = await db
        .select()
        .from(callRoutingNumbers)
        .where(
          and(
            eq(callRoutingNumbers.id, input.numberId),
            eq(callRoutingNumbers.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!number) throw new TRPCError({ code: "NOT_FOUND" });

      const config = await getPluginConfig(ctx.tenantId);
      if (config.twilioAccountSid && config.twilioAuthToken) {
        const twilio = (await import("twilio")).default;
        const client = twilio(config.twilioAccountSid, config.twilioAuthToken);
        await client.incomingPhoneNumbers(number.twilioSid).remove();
      }

      await db
        .update(callRoutingNumbers)
        .set({ status: "released", updatedAt: new Date() })
        .where(eq(callRoutingNumbers.id, input.numberId));

      return { success: true };
    }),

  // ── Update availability config for a number ────────────────────────────
  updateAvailability: tenantProcedure
    .input(
      z.object({
        numberId: z.string().uuid(),
        config: availabilityConfigSchema,
        forwardToNumber: z.string().optional(),
        label: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select({ id: callRoutingNumbers.id })
        .from(callRoutingNumbers)
        .where(
          and(
            eq(callRoutingNumbers.id, input.numberId),
            eq(callRoutingNumbers.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const updates: Partial<typeof callRoutingNumbers.$inferInsert> = {
        availabilityConfig: input.config,
        updatedAt: new Date(),
      };

      if (input.label !== undefined) updates.label = input.label;
      if (input.forwardToNumber !== undefined) {
        updates.forwardToNumber = input.forwardToNumber
          ? encryptValue(input.forwardToNumber)
          : null;
      }

      const [updated] = await db
        .update(callRoutingNumbers)
        .set(updates)
        .where(eq(callRoutingNumbers.id, input.numberId))
        .returning();

      return updated!;
    }),

  // ── Paginated missed call log ──────────────────────────────────────────
  getMissedCalls: tenantProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        numberId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit;
      const conditions = [eq(missedCallLogs.tenantId, ctx.tenantId)];
      if (input.numberId) {
        conditions.push(eq(missedCallLogs.virtualNumberId, input.numberId));
      }

      return db
        .select()
        .from(missedCallLogs)
        .where(and(...conditions))
        .orderBy(desc(missedCallLogs.occurredAt))
        .limit(input.limit)
        .offset(offset);
    }),

  // ── Paginated appointments ─────────────────────────────────────────────
  getAppointments: tenantProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        status: z.enum(["confirmed", "cancelled", "completed", "no_show"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const offset = (input.page - 1) * input.limit;
      const conditions = [eq(scheduledAppointments.tenantId, ctx.tenantId)];
      if (input.status) {
        conditions.push(eq(scheduledAppointments.status, input.status));
      }

      return db
        .select()
        .from(scheduledAppointments)
        .where(and(...conditions))
        .orderBy(desc(scheduledAppointments.scheduledAt))
        .limit(input.limit)
        .offset(offset);
    }),

  // ── Cancel an appointment ──────────────────────────────────────────────
  cancelAppointment: tenantProcedure
    .input(
      z.object({
        appointmentId: z.string().uuid(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [appt] = await db
        .select()
        .from(scheduledAppointments)
        .where(
          and(
            eq(scheduledAppointments.id, input.appointmentId),
            eq(scheduledAppointments.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!appt) throw new TRPCError({ code: "NOT_FOUND" });
      if (appt.status === "cancelled") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Already cancelled." });
      }

      const [updated] = await db
        .update(scheduledAppointments)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          cancellationReason: input.reason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(scheduledAppointments.id, input.appointmentId))
        .returning();

      return updated!;
    }),

  // ── Google Calendar: build OAuth URL ──────────────────────────────────
  getGoogleAuthUrl: tenantProcedure
    .input(z.object({ numberId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const config = await getPluginConfig(ctx.tenantId);
      if (!config.googleClientId || !config.googleClientSecret) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Google OAuth credentials not configured in plugin settings.",
        });
      }

      const { google } = await import("googleapis");
      const oauth2Client = new google.auth.OAuth2(
        config.googleClientId,
        config.googleClientSecret,
        `${config.schedulingPageBaseUrl || process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar/callback`
      );

      const state = Buffer.from(
        JSON.stringify({ numberId: input.numberId, tenantId: ctx.tenantId })
      ).toString("base64");

      const url = oauth2Client.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: ["https://www.googleapis.com/auth/calendar.readonly"],
        state,
      });

      return { url };
    }),

  // ── Microsoft Calendar: build OAuth URL ───────────────────────────────
  getMicrosoftAuthUrl: tenantProcedure
    .input(z.object({ numberId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const config = await getPluginConfig(ctx.tenantId);
      if (!config.microsoftClientId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Microsoft OAuth credentials not configured in plugin settings.",
        });
      }

      const tenantIdParam = config.microsoftTenantId || "common";
      const redirectUri = `${config.schedulingPageBaseUrl || process.env.NEXT_PUBLIC_APP_URL}/api/integrations/microsoft-calendar/callback`;

      const state = Buffer.from(
        JSON.stringify({ numberId: input.numberId, tenantId: ctx.tenantId })
      ).toString("base64");

      const params = new URLSearchParams({
        client_id: config.microsoftClientId,
        response_type: "code",
        redirect_uri: redirectUri,
        response_mode: "query",
        scope: "Calendars.Read offline_access",
        state,
      });

      const url = `https://login.microsoftonline.com/${tenantIdParam}/oauth2/v2.0/authorize?${params}`;

      return { url };
    }),

  // ── Disconnect a calendar integration ─────────────────────────────────
  disconnectCalendar: tenantProcedure
    .input(
      z.object({
        numberId: z.string().uuid(),
        provider: z.enum(["google", "microsoft"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select({ id: callRoutingNumbers.id })
        .from(callRoutingNumbers)
        .where(
          and(
            eq(callRoutingNumbers.id, input.numberId),
            eq(callRoutingNumbers.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const updates =
        input.provider === "google"
          ? {
              googleCalendarAccessToken: null,
              googleCalendarRefreshToken: null,
              googleCalendarTokenExpiresAt: null,
              googleCalendarConnected: false,
            }
          : {
              microsoftCalendarAccessToken: null,
              microsoftCalendarRefreshToken: null,
              microsoftCalendarTokenExpiresAt: null,
              microsoftCalendarConnected: false,
            };

      await db
        .update(callRoutingNumbers)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(callRoutingNumbers.id, input.numberId));

      return { success: true };
    }),

  // ── Get scheduling sessions (for admin view) ───────────────────────────
  getSchedulingSessions: tenantProcedure
    .input(
      z.object({
        missedCallLogId: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [eq(schedulingSessions.tenantId, ctx.tenantId)];
      if (input.missedCallLogId) {
        conditions.push(
          eq(schedulingSessions.missedCallLogId, input.missedCallLogId)
        );
      }

      return db
        .select()
        .from(schedulingSessions)
        .where(and(...conditions))
        .orderBy(desc(schedulingSessions.createdAt))
        .limit(input.limit);
    }),
});
