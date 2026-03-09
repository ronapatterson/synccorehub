import { relations } from "drizzle-orm";
import {
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
import { customers } from "./crm";
import { leads } from "./pipeline";

// ── Enums ─────────────────────────────────────────────────────────────────
export const activityTypeEnum = pgEnum("activity_type", [
  "note",
  "call",
  "email",
  "meeting",
  "demo",
  "task",
  "custom",
]);

// ── Activities ─────────────────────────────────────────────────────────────
// Polymorphic — linked to customer, lead, project, or contractor
export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    type: activityTypeEnum("type").notNull(),
    title: text("title"),
    content: text("content"),
    // Polymorphic relation — only one of these should be set
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    leadId: uuid("lead_id").references(() => leads.id, { onDelete: "cascade" }),
    projectId: uuid("project_id"), // FK added after projects schema (circular dep avoided with string)
    contractorId: uuid("contractor_id"),
    // Who logged it
    createdById: text("created_by_id").references(() => user.id, { onDelete: "set null" }),
    // When the activity happened (may differ from createdAt)
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
    // Duration in minutes (for calls, meetings)
    durationMinutes: text("duration_minutes"),
    // Extra data (e.g. email subject, call outcome)
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("activities_tenant_idx").on(t.tenantId),
    index("activities_customer_idx").on(t.customerId),
    index("activities_lead_idx").on(t.leadId),
    index("activities_project_idx").on(t.projectId),
    index("activities_created_by_idx").on(t.createdById),
    index("activities_occurred_at_idx").on(t.occurredAt),
  ]
);

// ── Relations ──────────────────────────────────────────────────────────────
export const activitiesRelations = relations(activities, ({ one }) => ({
  tenant: one(tenants, { fields: [activities.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [activities.customerId], references: [customers.id] }),
  lead: one(leads, { fields: [activities.leadId], references: [leads.id] }),
  createdBy: one(user, { fields: [activities.createdById], references: [user.id] }),
}));
