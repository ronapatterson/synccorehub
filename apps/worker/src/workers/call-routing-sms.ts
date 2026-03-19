/**
 * Call Routing SMS Worker
 *
 * Processes SendSchedulingSmsJob:
 * 1. Fetches the virtual number's availability config
 * 2. Generates available slots for next 14 days
 * 3. Subtracts busy windows from Google Calendar and/or Microsoft Calendar
 * 4. Creates a scheduling session with the slot snapshot
 * 5. Sends an SMS to the caller with the scheduling link
 */
import { Worker } from "bullmq";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { db } from "@synccorehub/database/client";
import {
  callRoutingNumbers,
  missedCallLogs,
  schedulingSessions,
  pluginConfigs,
  installedPlugins,
  plugins,
} from "@synccorehub/database/schema";
import { and, eq } from "drizzle-orm";
import { connection } from "../queues/index.js";
import type { SendSchedulingSmsJob, SlotSnapshot, AvailabilityConfig } from "../types.js";

// ── Encryption helpers ─────────────────────────────────────────────────────
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

function encryptValue(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

// ── Plugin config reader ───────────────────────────────────────────────────
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

// ── Slot generation ────────────────────────────────────────────────────────
type BusyWindow = { start: Date; end: Date };

function generateSlots(config: AvailabilityConfig, daysAhead = 14): SlotSnapshot[] {
  const results: SlotSnapshot[] = [];
  const now = new Date();
  const tz = config.timezone || "America/New_York";
  const duration = config.slotDurationMinutes || 30;

  for (let dayOffset = 1; dayOffset <= daysAhead; dayOffset++) {
    const targetDate = new Date(now.getTime() + dayOffset * 86_400_000);

    // Format date in recipient's timezone
    const localDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(targetDate); // "2026-03-15"

    // Get weekday in recipient's timezone
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
    })
      .format(targetDate)
      .toLowerCase(); // "mon", "tue" etc.

    const dayMap: Record<string, number> = {
      sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
    };
    const dayNum = dayMap[weekday] ?? 0;

    if (!config.days.includes(dayNum)) continue;

    // Generate slots for this day
    const slots: string[] = [];
    for (
      let hour = config.startHour;
      hour < config.endHour;
      hour += duration / 60
    ) {
      const slotHour = Math.floor(hour);
      const slotMinute = Math.round((hour - slotHour) * 60);

      // Build slot UTC timestamp from local date + hour/minute
      const utcDate = new Date(`${localDate}T${String(slotHour).padStart(2, "0")}:${String(slotMinute).padStart(2, "0")}:00`);

      // Skip if slot is in the past (add 30min buffer)
      if (utcDate <= new Date(now.getTime() + 30 * 60_000)) continue;

      slots.push(utcDate.toISOString());
    }

    if (slots.length > 0) {
      results.push({ date: localDate, slots });
    }
  }

  return results;
}

function filterBusySlots(
  snapshot: SlotSnapshot[],
  busyWindows: BusyWindow[],
  durationMinutes: number
): SlotSnapshot[] {
  return snapshot.map((day) => ({
    ...day,
    slots: day.slots.filter((slotIso) => {
      const slotStart = new Date(slotIso);
      const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);

      return !busyWindows.some(
        (busy) => slotStart < busy.end && slotEnd > busy.start
      );
    }),
  }));
}

// ── Google Calendar ────────────────────────────────────────────────────────
async function fetchGoogleBusyWindows(
  number: typeof callRoutingNumbers.$inferSelect,
  config: Record<string, string>,
  timeMin: Date,
  timeMax: Date
): Promise<BusyWindow[]> {
  if (!number.googleCalendarConnected || !number.googleCalendarAccessToken) {
    return [];
  }

  const clientId = config.googleClientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = config.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return [];

  const { google } = await import("googleapis");
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.GOOGLE_REDIRECT_URI
  );

  let accessToken = decryptValue(number.googleCalendarAccessToken);
  const refreshToken = number.googleCalendarRefreshToken
    ? decryptValue(number.googleCalendarRefreshToken)
    : null;

  // Refresh token if expired
  if (
    number.googleCalendarTokenExpiresAt &&
    new Date(number.googleCalendarTokenExpiresAt) <= new Date(Date.now() + 60_000)
  ) {
    if (refreshToken) {
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await oauth2Client.refreshAccessToken();
      accessToken = credentials.access_token!;

      // Persist refreshed tokens
      await db
        .update(callRoutingNumbers)
        .set({
          googleCalendarAccessToken: encryptValue(accessToken),
          googleCalendarTokenExpiresAt: credentials.expiry_date
            ? new Date(credentials.expiry_date)
            : undefined,
          updatedAt: new Date(),
        })
        .where(eq(callRoutingNumbers.id, number.id));
    }
  }

  oauth2Client.setCredentials({ access_token: accessToken });
  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  try {
    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: number.googleCalendarId ?? "primary" }],
      },
    });

    const busy = freeBusy.data.calendars?.[number.googleCalendarId ?? "primary"]?.busy ?? [];
    return busy
      .filter((b) => b.start && b.end)
      .map((b) => ({ start: new Date(b.start!), end: new Date(b.end!) }));
  } catch (err) {
    console.error("[call-routing-sms] Google Calendar fetch error:", err);
    return [];
  }
}

// ── Microsoft Calendar ─────────────────────────────────────────────────────
async function fetchMicrosoftBusyWindows(
  number: typeof callRoutingNumbers.$inferSelect,
  config: Record<string, string>,
  timeMin: Date,
  timeMax: Date
): Promise<BusyWindow[]> {
  if (!number.microsoftCalendarConnected || !number.microsoftCalendarAccessToken) {
    return [];
  }

  let accessToken = decryptValue(number.microsoftCalendarAccessToken);
  const refreshToken = number.microsoftCalendarRefreshToken
    ? decryptValue(number.microsoftCalendarRefreshToken)
    : null;

  // Refresh if expired
  if (
    number.microsoftCalendarTokenExpiresAt &&
    new Date(number.microsoftCalendarTokenExpiresAt) <= new Date(Date.now() + 60_000)
  ) {
    if (refreshToken) {
      const clientId = config.microsoftClientId || process.env.MICROSOFT_CLIENT_ID;
      const clientSecret = config.microsoftClientSecret || process.env.MICROSOFT_CLIENT_SECRET;
      const msftTenantId = config.microsoftTenantId || process.env.MICROSOFT_TENANT_ID || "common";

      const tokenRes = await fetch(
        `https://login.microsoftonline.com/${msftTenantId}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId ?? "",
            client_secret: clientSecret ?? "",
            refresh_token: refreshToken,
            grant_type: "refresh_token",
            scope: "Calendars.Read offline_access",
          }),
        }
      );

      if (tokenRes.ok) {
        const tokenData = (await tokenRes.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
        };
        accessToken = tokenData.access_token;

        await db
          .update(callRoutingNumbers)
          .set({
            microsoftCalendarAccessToken: encryptValue(accessToken),
            microsoftCalendarRefreshToken: tokenData.refresh_token
              ? encryptValue(tokenData.refresh_token)
              : undefined,
            microsoftCalendarTokenExpiresAt: tokenData.expires_in
              ? new Date(Date.now() + tokenData.expires_in * 1000)
              : undefined,
            updatedAt: new Date(),
          })
          .where(eq(callRoutingNumbers.id, number.id));
      }
    }
  }

  try {
    const res = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendarView?startDateTime=${timeMin.toISOString()}&endDateTime=${timeMax.toISOString()}&$select=start,end,subject&$top=100`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!res.ok) return [];

    const data = (await res.json()) as {
      value?: Array<{ start: { dateTime: string }; end: { dateTime: string } }>;
    };

    return (data.value ?? []).map((e) => ({
      start: new Date(e.start.dateTime + "Z"),
      end: new Date(e.end.dateTime + "Z"),
    }));
  } catch (err) {
    console.error("[call-routing-sms] Microsoft Calendar fetch error:", err);
    return [];
  }
}

// ── Worker ─────────────────────────────────────────────────────────────────
export function createCallRoutingSmsWorker() {
  const worker = new Worker<SendSchedulingSmsJob>(
    "call-routing-sms",
    async (job) => {
      const { tenantId, missedCallLogId, virtualNumberId, callerPhone, callerName } = job.data;

      console.log(`[call-routing-sms] Processing job for missedCallLog ${missedCallLogId}`);

      // Fetch the virtual number and plugin config
      const [number] = await db
        .select()
        .from(callRoutingNumbers)
        .where(eq(callRoutingNumbers.id, virtualNumberId))
        .limit(1);

      if (!number) {
        console.error(`[call-routing-sms] Virtual number ${virtualNumberId} not found`);
        return;
      }

      const config = await getPluginConfig(tenantId);
      if (!config.twilioAccountSid || !config.twilioAuthToken) {
        console.error(`[call-routing-sms] No Twilio credentials for tenant ${tenantId}`);
        return;
      }

      const availConfig: AvailabilityConfig = (number.availabilityConfig as AvailabilityConfig) ?? {
        days: [1, 2, 3, 4, 5],
        startHour: 9,
        endHour: 17,
        timezone: "America/New_York",
        slotDurationMinutes: 30,
      };

      // Generate base slots
      let snapshot = generateSlots(availConfig, 14);

      // Subtract calendar busy windows
      const timeMin = new Date();
      const timeMax = new Date(timeMin.getTime() + 14 * 86_400_000);

      const [googleBusy, microsoftBusy] = await Promise.all([
        fetchGoogleBusyWindows(number, config, timeMin, timeMax),
        fetchMicrosoftBusyWindows(number, config, timeMin, timeMax),
      ]);

      const allBusy = [...googleBusy, ...microsoftBusy];
      if (allBusy.length > 0) {
        snapshot = filterBusySlots(snapshot, allBusy, availConfig.slotDurationMinutes);
      }

      // Generate a unique token for this session
      const token = randomBytes(32).toString("hex");
      const ttlHours = parseInt(config.schedulingLinkTtlHours || "48") || 48;
      const expiresAt = new Date(Date.now() + ttlHours * 3_600_000);

      // Create the scheduling session
      const [session] = await db
        .insert(schedulingSessions)
        .values({
          tenantId,
          missedCallLogId,
          virtualNumberId,
          token,
          callerPhone,
          callerName,
          status: "pending",
          expiresAt,
          availableSlotsSnapshot: snapshot,
        })
        .returning();

      if (!session) {
        throw new Error("Failed to create scheduling session");
      }

      // Update missed call log
      await db
        .update(missedCallLogs)
        .set({ status: "session_created", schedulingSessionId: session.id })
        .where(eq(missedCallLogs.id, missedCallLogId));

      // Build and send the SMS
      const appBaseUrl =
        config.schedulingPageBaseUrl || process.env.NEXT_PUBLIC_APP_URL || "";
      const schedulingUrl = `${appBaseUrl}/schedule/${token}`;

      const greeting = callerName ? `Hi ${callerName}!` : "Hi!";
      const smsBody = `${greeting} ${number.label ? `You called ${number.label}.` : "You recently called."} Book a callback here: ${schedulingUrl} (expires in ${ttlHours}h)`;

      const twilio = (await import("twilio")).default;
      const client = twilio(config.twilioAccountSid, config.twilioAuthToken);

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

      // Mark log as SMS sent
      await db
        .update(missedCallLogs)
        .set({ status: "sms_sent" })
        .where(eq(missedCallLogs.id, missedCallLogId));

      console.log(`[call-routing-sms] SMS sent to ${callerPhone}, session ${session.id}`);
    },
    {
      connection,
      concurrency: 3,
    }
  );

  worker.on("failed", (job, err) => {
    console.error(`[call-routing-sms] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
