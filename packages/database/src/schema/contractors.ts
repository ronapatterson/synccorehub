import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { tasks, taskAssignments } from "./projects";

// ── Enums ─────────────────────────────────────────────────────────────────
export const contractorTypeEnum = pgEnum("contractor_type", [
  "individual",
  "agency",
]);

export const contractorStatusEnum = pgEnum("contractor_status", [
  "active",
  "inactive",
  "pending_onboarding",
]);

export const timeEntryStatusEnum = pgEnum("time_entry_status", [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "invoiced",
]);

// ── Contractors ────────────────────────────────────────────────────────────
export const contractors = pgTable(
  "contractors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    type: contractorTypeEnum("type").notNull().default("individual"),
    status: contractorStatusEnum("status").notNull().default("pending_onboarding"),
    // Contact
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    // Company (for agencies)
    companyName: text("company_name"),
    website: text("website"),
    // Skills & expertise
    skills: text("skills").array().default([]),
    specializations: text("specializations").array().default([]),
    bio: text("bio"),
    // Rates
    hourlyRateCents: doublePrecision("hourly_rate_cents"),
    currency: text("currency").default("USD"),
    // Contract
    contractStartDate: timestamp("contract_start_date", { withTimezone: true }),
    contractEndDate: timestamp("contract_end_date", { withTimezone: true }),
    // Portal access (contractors get a portal login to see their tasks)
    portalEnabled: boolean("portal_enabled").default(false),
    portalUserId: text("portal_user_id"),
    // Payment
    taxId: text("tax_id"),
    paymentMethod: text("payment_method"), // "bank_transfer" | "paypal" | "stripe"
    paymentDetails: text("payment_details"), // encrypted JSON
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("contractors_tenant_idx").on(t.tenantId),
    index("contractors_email_idx").on(t.tenantId, t.email),
    index("contractors_status_idx").on(t.tenantId, t.status),
  ]
);

// ── Time Entries ────────────────────────────────────────────────────────────
export const timeEntries = pgTable(
  "time_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    contractorId: uuid("contractor_id").notNull().references(() => contractors.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "set null" }),
    description: text("description"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    // Duration in minutes — set explicitly or computed from start/end
    durationMinutes: doublePrecision("duration_minutes"),
    isBillable: boolean("is_billable").default(true),
    hourlyRateCents: doublePrecision("hourly_rate_cents"),
    status: timeEntryStatusEnum("status").notNull().default("draft"),
    // Approval
    approvedById: text("approved_by_id"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    rejectionReason: text("rejection_reason"),
    // Invoicing
    invoiceId: text("invoice_id"),
    invoicedAt: timestamp("invoiced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("time_entries_contractor_idx").on(t.contractorId),
    index("time_entries_task_idx").on(t.taskId),
    index("time_entries_status_idx").on(t.tenantId, t.status),
    index("time_entries_started_at_idx").on(t.tenantId, t.startedAt),
  ]
);

// ── Relations ──────────────────────────────────────────────────────────────
export const contractorsRelations = relations(contractors, ({ one, many }) => ({
  tenant: one(tenants, { fields: [contractors.tenantId], references: [tenants.id] }),
  timeEntries: many(timeEntries),
  taskAssignments: many(taskAssignments),
}));

export const timeEntriesRelations = relations(timeEntries, ({ one }) => ({
  tenant: one(tenants, { fields: [timeEntries.tenantId], references: [tenants.id] }),
  contractor: one(contractors, { fields: [timeEntries.contractorId], references: [contractors.id] }),
  task: one(tasks, { fields: [timeEntries.taskId], references: [tasks.id] }),
}));
