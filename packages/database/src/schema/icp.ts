import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { user } from "./auth";

// ── ICP Profiles ──────────────────────────────────────────────────────────
// A tenant can have multiple named ICP profiles (e.g. "SMB ICP", "Enterprise ICP")
export const icpProfiles = pgTable(
  "icp_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    isDefault: boolean("is_default").default(false),
    // Total weight sum — criteria weights must sum to this (or 100)
    // Computed & stored for validation
    totalWeight: doublePrecision("total_weight").default(100),
    // Scoring threshold: customers with score >= this are "ICP matched"
    matchThreshold: doublePrecision("match_threshold").default(70),
    createdById: text("created_by_id").references(() => user.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("icp_profiles_tenant_idx").on(t.tenantId)]
);

// ── ICP Criteria ──────────────────────────────────────────────────────────
// Each criterion defines a weighted rule against customer fields
export const icpCriteria = pgTable(
  "icp_criteria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id").notNull().references(() => icpProfiles.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    // Which customer field this criterion targets
    // e.g. "industry", "company_size", "annual_revenue", "country", custom field key
    field: text("field").notNull(),
    fieldLabel: text("field_label").notNull(), // Human-readable
    // Operator: eq, in, gte, lte, contains, is_not_null
    operator: text("operator").notNull(),
    // Value(s) to match against
    value: jsonb("value").$type<unknown>().notNull(),
    // Weight of this criterion (0-100); all criteria weights should sum to profile.totalWeight
    weight: doublePrecision("weight").notNull(),
    // Points earned if criterion matches (0-weight)
    // Allows partial scoring: e.g. partial industry match
    pointsIfMatch: doublePrecision("points_if_match").notNull(),
    isActive: boolean("is_active").default(true),
    sortOrder: integer("sort_order").default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("icp_criteria_profile_idx").on(t.profileId),
    index("icp_criteria_tenant_idx").on(t.tenantId),
  ]
);

// ── Relations ──────────────────────────────────────────────────────────────
export const icpProfilesRelations = relations(icpProfiles, ({ one, many }) => ({
  tenant: one(tenants, { fields: [icpProfiles.tenantId], references: [tenants.id] }),
  criteria: many(icpCriteria),
}));

export const icpCriteriaRelations = relations(icpCriteria, ({ one }) => ({
  profile: one(icpProfiles, { fields: [icpCriteria.profileId], references: [icpProfiles.id] }),
}));
