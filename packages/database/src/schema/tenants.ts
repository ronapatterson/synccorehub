import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ── Enums ─────────────────────────────────────────────────────────────────
export const planTierEnum = pgEnum("plan_tier", [
  "free",
  "starter",
  "growth",
  "enterprise",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "paused",
]);

// ── Tenants ───────────────────────────────────────────────────────────────
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#6366f1"),
  portalDomain: text("portal_domain").unique(), // custom domain e.g. portal.acme.com
  portalSubdomain: text("portal_subdomain").unique(), // acme (-> acme-portal.synccorehub.com)
  // Onboarding
  onboardingCompleted: boolean("onboarding_completed").default(false),
  industry: text("industry"),
  companySize: text("company_size"),
  // Billing
  stripeCustomerId: text("stripe_customer_id").unique(),
  // Settings (flexible JSON)
  settings: jsonb("settings").$type<TenantSettings>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type TenantSettings = {
  emailNotifications?: boolean;
  slackWebhookUrl?: string;
  defaultCurrency?: string;
  fiscalYearStart?: number; // 1-12
  timeZone?: string;
};

// ── Plans ─────────────────────────────────────────────────────────────────
export const plans = pgTable("plans", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  tier: planTierEnum("tier").notNull(),
  stripePriceId: text("stripe_price_id").unique(),
  monthlyPrice: integer("monthly_price").notNull().default(0), // cents
  yearlyPrice: integer("yearly_price").notNull().default(0),   // cents
  maxUsers: integer("max_users"),
  maxCustomers: integer("max_customers"),
  maxProjects: integer("max_projects"),
  maxPlugins: integer("max_plugins").default(3),
  features: jsonb("features").$type<string[]>().default([]),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Subscriptions ─────────────────────────────────────────────────────────
export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
  planId: uuid("plan_id").references(() => plans.id),
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  status: subscriptionStatusEnum("status").notNull().default("trialing"),
  currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ── Relations ─────────────────────────────────────────────────────────────
export const tenantsRelations = relations(tenants, ({ many, one }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  tenant: one(tenants, { fields: [subscriptions.tenantId], references: [tenants.id] }),
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
}));
