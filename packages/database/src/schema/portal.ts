import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { customers } from "./crm";

// ── Portal Users ───────────────────────────────────────────────────────────
// Separate from business users — these are the end customers logging into the portal
export const portalUsers = pgTable(
  "portal_users",
  {
    id: text("id").primaryKey(), // Better Auth manages IDs
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").default(false),
    name: text("name"),
    avatarUrl: text("avatar_url"),
    // Magic link / password auth
    password: text("password"),
    magicLinkToken: text("magic_link_token"),
    magicLinkExpiresAt: timestamp("magic_link_expires_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    isActive: boolean("is_active").default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("portal_users_tenant_idx").on(t.tenantId),
    index("portal_users_email_idx").on(t.tenantId, t.email),
    index("portal_users_customer_idx").on(t.customerId),
  ]
);

// ── Portal Sessions ────────────────────────────────────────────────────────
export const portalSessions = pgTable(
  "portal_sessions",
  {
    id: text("id").primaryKey(),
    portalUserId: text("portal_user_id").notNull().references(() => portalUsers.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("portal_sessions_user_idx").on(t.portalUserId),
    index("portal_sessions_token_idx").on(t.token),
  ]
);

// ── Relations ──────────────────────────────────────────────────────────────
export const portalUsersRelations = relations(portalUsers, ({ one, many }) => ({
  tenant: one(tenants, { fields: [portalUsers.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [portalUsers.customerId], references: [customers.id] }),
  sessions: many(portalSessions),
}));

export const portalSessionsRelations = relations(portalSessions, ({ one }) => ({
  portalUser: one(portalUsers, { fields: [portalSessions.portalUserId], references: [portalUsers.id] }),
  tenant: one(tenants, { fields: [portalSessions.tenantId], references: [tenants.id] }),
}));
