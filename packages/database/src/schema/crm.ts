import { relations, sql } from "drizzle-orm";
import {
  doublePrecision,
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
export const customerStatusEnum = pgEnum("customer_status", [
  "active",
  "inactive",
  "churned",
  "prospect",
]);

export const segmentTypeEnum = pgEnum("segment_type", ["static", "dynamic"]);

// ── Customers ─────────────────────────────────────────────────────────────
export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    // Contact
    firstName: text("first_name"),
    lastName: text("last_name"),
    email: text("email"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    // Company
    company: text("company"),
    jobTitle: text("job_title"),
    website: text("website"),
    industry: text("industry"),
    companySize: text("company_size"),   // e.g. "1-10", "11-50", "51-200", "201-1000", "1000+"
    annualRevenue: text("annual_revenue"), // e.g. "$0-$100k", "$100k-$1M", "$1M-$10M"
    country: text("country"),
    city: text("city"),
    // CRM
    status: customerStatusEnum("status").notNull().default("prospect"),
    ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
    tags: text("tags").array().default([]),
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>().default({}),
    notes: text("notes"),
    // ICP scoring (0-100, recomputed by worker)
    icpScore: doublePrecision("icp_score"),
    icpProfileId: uuid("icp_profile_id"), // which ICP profile was used for scoring
    // Source tracking
    source: text("source"), // "direct", "referral", "marketing", "import", "api"
    sourceDetail: text("source_detail"), // e.g. referral code
    // Soft delete
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("customers_tenant_id_idx").on(t.tenantId),
    index("customers_email_idx").on(t.tenantId, t.email),
    index("customers_company_idx").on(t.tenantId, t.company),
    index("customers_icp_score_idx").on(t.tenantId, t.icpScore),
    // Partial index — only non-deleted rows
    index("customers_active_idx").on(t.tenantId).where(sql`${t.deletedAt} IS NULL`),
  ]
);

// ── Segments ───────────────────────────────────────────────────────────────
export const segments = pgTable("segments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  type: segmentTypeEnum("type").notNull().default("static"),
  // For dynamic segments: filter rules as JSON DSL
  // e.g. { "operator": "AND", "rules": [{ "field": "industry", "op": "eq", "value": "SaaS" }] }
  filterRules: jsonb("filter_rules").$type<FilterRuleGroup>(),
  color: text("color").default("#6366f1"),
  createdById: text("created_by_id").references(() => user.id),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type FilterRuleGroup = {
  operator: "AND" | "OR";
  rules: Array<FilterRule | FilterRuleGroup>;
};

export type FilterRule = {
  field: string;
  op: "eq" | "neq" | "in" | "not_in" | "contains" | "gte" | "lte" | "between" | "is_null" | "is_not_null";
  value: unknown;
};

// ── Segment members (for static segments) ─────────────────────────────────
export const customerSegmentMembers = pgTable(
  "customer_segment_members",
  {
    segmentId: uuid("segment_id").notNull().references(() => segments.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("csm_segment_idx").on(t.segmentId),
    index("csm_customer_idx").on(t.customerId),
  ]
);

// ── Relations ──────────────────────────────────────────────────────────────
export const customersRelations = relations(customers, ({ one, many }) => ({
  tenant: one(tenants, { fields: [customers.tenantId], references: [tenants.id] }),
  owner: one(user, { fields: [customers.ownerId], references: [user.id] }),
  segmentMembers: many(customerSegmentMembers),
}));

export const segmentsRelations = relations(segments, ({ one, many }) => ({
  tenant: one(tenants, { fields: [segments.tenantId], references: [tenants.id] }),
  members: many(customerSegmentMembers),
}));

export const customerSegmentMembersRelations = relations(customerSegmentMembers, ({ one }) => ({
  segment: one(segments, { fields: [customerSegmentMembers.segmentId], references: [segments.id] }),
  customer: one(customers, { fields: [customerSegmentMembers.customerId], references: [customers.id] }),
}));
