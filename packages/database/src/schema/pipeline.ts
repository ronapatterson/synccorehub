import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
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

// ── Enums ─────────────────────────────────────────────────────────────────
export const leadStatusEnum = pgEnum("lead_status", [
  "open",
  "won",
  "lost",
  "disqualified",
]);

// ── Pipelines ─────────────────────────────────────────────────────────────
export const pipelines = pgTable("pipelines", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  isDefault: boolean("is_default").default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Pipeline Stages ────────────────────────────────────────────────────────
export const pipelineStages = pgTable(
  "pipeline_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pipelineId: uuid("pipeline_id").notNull().references(() => pipelines.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").default("#6366f1"),
    // Fractional position for ordering without re-indexing
    position: doublePrecision("position").notNull(),
    // Win probability % (0-100) — used for weighted pipeline value
    winProbability: doublePrecision("win_probability").default(0),
    // Days without activity before showing "rotting" alert
    rottingDays: integer("rotting_days"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("pipeline_stages_pipeline_idx").on(t.pipelineId)]
);

// ── Leads ──────────────────────────────────────────────────────────────────
export const leads = pgTable(
  "leads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    pipelineId: uuid("pipeline_id").notNull().references(() => pipelines.id),
    stageId: uuid("stage_id").notNull().references(() => pipelineStages.id),
    // Link to customer (optional — lead may not yet be a customer)
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    // Lead details
    title: text("title").notNull(),
    value: doublePrecision("value"), // deal value in cents
    currency: text("currency").default("USD"),
    // Assignment
    ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
    status: leadStatusEnum("status").notNull().default("open"),
    // Expected close date
    expectedCloseDate: timestamp("expected_close_date", { withTimezone: true }),
    // Last activity — used for rotting alerts
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    // Fractional position within stage (for kanban ordering)
    position: doublePrecision("position").notNull().default(0),
    // Custom fields
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>().default({}),
    // Source
    source: text("source"),
    // Optimistic lock
    version: integer("version").notNull().default(1),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("leads_tenant_idx").on(t.tenantId),
    index("leads_pipeline_idx").on(t.pipelineId),
    index("leads_stage_idx").on(t.stageId),
    index("leads_owner_idx").on(t.ownerId),
    index("leads_customer_idx").on(t.customerId),
  ]
);

// ── Lead Stage History ─────────────────────────────────────────────────────
// Tracks every stage transition for velocity analytics
export const leadStageHistory = pgTable(
  "lead_stage_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id").notNull().references(() => leads.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    fromStageId: uuid("from_stage_id").references(() => pipelineStages.id),
    toStageId: uuid("to_stage_id").references(() => pipelineStages.id),
    changedById: text("changed_by_id").references(() => user.id),
    movedAt: timestamp("moved_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("lsh_lead_idx").on(t.leadId)]
);

// ── Relations ──────────────────────────────────────────────────────────────
export const pipelinesRelations = relations(pipelines, ({ one, many }) => ({
  tenant: one(tenants, { fields: [pipelines.tenantId], references: [tenants.id] }),
  stages: many(pipelineStages),
  leads: many(leads),
}));

export const pipelineStagesRelations = relations(pipelineStages, ({ one, many }) => ({
  pipeline: one(pipelines, { fields: [pipelineStages.pipelineId], references: [pipelines.id] }),
  leads: many(leads),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  tenant: one(tenants, { fields: [leads.tenantId], references: [tenants.id] }),
  pipeline: one(pipelines, { fields: [leads.pipelineId], references: [pipelines.id] }),
  stage: one(pipelineStages, { fields: [leads.stageId], references: [pipelineStages.id] }),
  customer: one(customers, { fields: [leads.customerId], references: [customers.id] }),
  owner: one(user, { fields: [leads.ownerId], references: [user.id] }),
  stageHistory: many(leadStageHistory),
}));
