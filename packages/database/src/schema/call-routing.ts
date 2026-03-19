import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { user } from "./auth";

// ── Enums ─────────────────────────────────────────────────────────────────
export const callRoutingNumberStatusEnum = pgEnum("call_routing_number_status", [
  "active",
  "released",
  "pending",
]);

export const missedCallStatusEnum = pgEnum("missed_call_status", [
  "missed",
  "sms_sent",
  "session_created",
  "scheduled",
  "expired",
  "no_action",
]);

export const schedulingSessionStatusEnum = pgEnum("scheduling_session_status", [
  "pending",
  "viewed",
  "scheduled",
  "expired",
  "cancelled",
]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "confirmed",
  "cancelled",
  "rescheduled",
  "completed",
  "no_show",
]);

// ── Types ──────────────────────────────────────────────────────────────────
export type AvailabilityConfig = {
  days: number[]; // 0=Sun, 1=Mon ... 6=Sat
  startHour: number; // e.g. 9 (9:00 AM)
  endHour: number; // e.g. 17 (5:00 PM)
  timezone: string; // IANA timezone, e.g. "America/New_York"
  slotDurationMinutes: number; // default 30
};

export type SlotSnapshot = {
  date: string; // "2026-03-15" in recipient's local timezone
  slots: string[]; // ISO datetime strings in UTC, e.g. ["2026-03-15T14:00:00Z"]
};

// ── Virtual Phone Numbers ──────────────────────────────────────────────────
// One Twilio virtual number per CRM user. Calls to this number try to reach
// the user first; on no-answer the IVR kicks in.
export const callRoutingNumbers = pgTable(
  "call_routing_numbers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    // The CRM user this number belongs to (the "recipient")
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Twilio-assigned virtual number in E.164 format, e.g. +15551234567
    phoneNumber: text("phone_number").notNull().unique(),
    // Twilio Phone Number SID for management
    twilioSid: text("twilio_sid").notNull(),
    // The user's real phone number to try first (stored encrypted)
    forwardToNumber: text("forward_to_number"),
    label: text("label"),
    status: callRoutingNumberStatusEnum("status").notNull().default("active"),
    // Availability config — JSON for flexibility
    availabilityConfig: jsonb("availability_config")
      .$type<AvailabilityConfig>()
      .default({ days: [1, 2, 3, 4, 5], startHour: 9, endHour: 17, timezone: "UTC", slotDurationMinutes: 30 }),
    // Google Calendar integration
    googleCalendarAccessToken: text("google_calendar_access_token"),
    googleCalendarRefreshToken: text("google_calendar_refresh_token"),
    googleCalendarTokenExpiresAt: timestamp("google_calendar_token_expires_at", {
      withTimezone: true,
    }),
    googleCalendarConnected: boolean("google_calendar_connected").default(false),
    googleCalendarId: text("google_calendar_id").default("primary"),
    // Microsoft Calendar integration
    microsoftCalendarAccessToken: text("microsoft_calendar_access_token"),
    microsoftCalendarRefreshToken: text("microsoft_calendar_refresh_token"),
    microsoftCalendarTokenExpiresAt: timestamp(
      "microsoft_calendar_token_expires_at",
      { withTimezone: true }
    ),
    microsoftCalendarConnected: boolean("microsoft_calendar_connected").default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("call_routing_numbers_tenant_idx").on(t.tenantId),
    index("call_routing_numbers_user_idx").on(t.userId),
    index("call_routing_numbers_phone_idx").on(t.phoneNumber),
  ]
);

// ── Missed Call Logs ───────────────────────────────────────────────────────
// One record per Twilio call SID. Created when a call goes unanswered and
// the IVR collects the caller's info.
export const missedCallLogs = pgTable(
  "missed_call_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    virtualNumberId: uuid("virtual_number_id")
      .notNull()
      .references(() => callRoutingNumbers.id, { onDelete: "cascade" }),
    // Unique Twilio call identifier
    callSid: text("call_sid").notNull().unique(),
    // Caller's phone number from Twilio (E.164)
    fromNumber: text("from_number").notNull(),
    // Collected from IVR (may differ from fromNumber)
    callerName: text("caller_name"),
    callerCallbackNumber: text("caller_callback_number"),
    status: missedCallStatusEnum("status").notNull().default("missed"),
    // Raw Twilio webhook payload for debugging
    twilioPayload: jsonb("twilio_payload")
      .$type<Record<string, unknown>>()
      .default({}),
    // Link to the scheduling session once created
    schedulingSessionId: uuid("scheduling_session_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("missed_call_logs_tenant_idx").on(t.tenantId),
    index("missed_call_logs_virtual_number_idx").on(t.virtualNumberId),
    index("missed_call_logs_call_sid_idx").on(t.callSid),
    index("missed_call_logs_status_idx").on(t.status),
    index("missed_call_logs_occurred_at_idx").on(t.occurredAt),
  ]
);

// ── Scheduling Sessions ────────────────────────────────────────────────────
// Token-bound session sent to the caller via SMS. Powers the public
// /schedule/[token] page.
export const schedulingSessions = pgTable(
  "scheduling_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    missedCallLogId: uuid("missed_call_log_id")
      .notNull()
      .references(() => missedCallLogs.id, { onDelete: "cascade" }),
    virtualNumberId: uuid("virtual_number_id")
      .notNull()
      .references(() => callRoutingNumbers.id, { onDelete: "cascade" }),
    // 64-char hex token (32 random bytes) — powers the public URL
    token: text("token").notNull().unique(),
    // Pre-filled caller info from IVR
    callerPhone: text("caller_phone").notNull(),
    callerName: text("caller_name"),
    status: schedulingSessionStatusEnum("status").notNull().default("pending"),
    // Token expires 48 hours after creation
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // Snapshot of available slots computed at SMS-send time.
    // Avoids needing calendar API access on the public page.
    availableSlotsSnapshot: jsonb("available_slots_snapshot")
      .$type<SlotSnapshot[]>()
      .default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("scheduling_sessions_token_idx").on(t.token),
    index("scheduling_sessions_tenant_idx").on(t.tenantId),
    index("scheduling_sessions_expires_at_idx").on(t.expiresAt),
  ]
);

// ── Scheduled Appointments ─────────────────────────────────────────────────
// Confirmed booking after a caller selects a slot.
export const scheduledAppointments = pgTable(
  "scheduled_appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    schedulingSessionId: uuid("scheduling_session_id")
      .notNull()
      .references(() => schedulingSessions.id, { onDelete: "cascade" }),
    virtualNumberId: uuid("virtual_number_id")
      .notNull()
      .references(() => callRoutingNumbers.id),
    // The CRM user being booked with
    recipientUserId: text("recipient_user_id")
      .notNull()
      .references(() => user.id),
    // Caller info (denormalized for display)
    callerPhone: text("caller_phone").notNull(),
    callerName: text("caller_name"),
    // Appointment time (UTC)
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    durationMinutes: text("duration_minutes").notNull().default("30"),
    status: appointmentStatusEnum("status").notNull().default("confirmed"),
    // Link back to the CRM Activity created for this appointment
    activityId: uuid("activity_id"), // soft FK to activities.id
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).defaultNow().notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("scheduled_appointments_tenant_idx").on(t.tenantId),
    index("scheduled_appointments_recipient_idx").on(t.recipientUserId),
    index("scheduled_appointments_scheduled_at_idx").on(t.scheduledAt),
    index("scheduled_appointments_status_idx").on(t.status),
  ]
);

// ── Relations ──────────────────────────────────────────────────────────────
export const callRoutingNumbersRelations = relations(
  callRoutingNumbers,
  ({ one, many }) => ({
    tenant: one(tenants, {
      fields: [callRoutingNumbers.tenantId],
      references: [tenants.id],
    }),
    user: one(user, {
      fields: [callRoutingNumbers.userId],
      references: [user.id],
    }),
    missedCallLogs: many(missedCallLogs),
    schedulingSessions: many(schedulingSessions),
    scheduledAppointments: many(scheduledAppointments),
  })
);

export const missedCallLogsRelations = relations(missedCallLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [missedCallLogs.tenantId],
    references: [tenants.id],
  }),
  virtualNumber: one(callRoutingNumbers, {
    fields: [missedCallLogs.virtualNumberId],
    references: [callRoutingNumbers.id],
  }),
  schedulingSession: one(schedulingSessions, {
    fields: [missedCallLogs.schedulingSessionId],
    references: [schedulingSessions.id],
  }),
}));

export const schedulingSessionsRelations = relations(
  schedulingSessions,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [schedulingSessions.tenantId],
      references: [tenants.id],
    }),
    missedCallLog: one(missedCallLogs, {
      fields: [schedulingSessions.missedCallLogId],
      references: [missedCallLogs.id],
    }),
    virtualNumber: one(callRoutingNumbers, {
      fields: [schedulingSessions.virtualNumberId],
      references: [callRoutingNumbers.id],
    }),
  })
);

export const scheduledAppointmentsRelations = relations(
  scheduledAppointments,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [scheduledAppointments.tenantId],
      references: [tenants.id],
    }),
    schedulingSession: one(schedulingSessions, {
      fields: [scheduledAppointments.schedulingSessionId],
      references: [schedulingSessions.id],
    }),
    virtualNumber: one(callRoutingNumbers, {
      fields: [scheduledAppointments.virtualNumberId],
      references: [callRoutingNumbers.id],
    }),
    recipientUser: one(user, {
      fields: [scheduledAppointments.recipientUserId],
      references: [user.id],
    }),
  })
);
