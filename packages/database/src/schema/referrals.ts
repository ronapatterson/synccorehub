import { relations } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenants } from "./tenants";
import { customers } from "./crm";
import { portalUsers } from "./portal";

// ── Enums ─────────────────────────────────────────────────────────────────
export const referralStatusEnum = pgEnum("referral_status", [
  "pending",    // Code was used, waiting for qualification
  "qualified",  // Referred user completed qualification action
  "rewarded",   // Reward has been issued
  "rejected",   // Rejected (fraud, ineligible)
]);

export const rewardTransactionTypeEnum = pgEnum("reward_transaction_type", [
  "credit",   // Points added
  "debit",    // Points spent / redeemed
  "expired",  // Points expired
  "adjusted", // Manual adjustment
]);

// ── Referral Codes ─────────────────────────────────────────────────────────
export const referralCodes = pgTable(
  "referral_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    portalUserId: text("portal_user_id").notNull().references(() => portalUsers.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    code: text("code").notNull(),
    isActive: boolean("is_active").default(true),
    maxUses: integer("max_uses"), // null = unlimited
    useCount: integer("use_count").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("referral_codes_tenant_code_idx").on(t.tenantId, t.code),
    index("referral_codes_portal_user_idx").on(t.portalUserId),
  ]
);

// ── Referrals ──────────────────────────────────────────────────────────────
export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    referralCodeId: uuid("referral_code_id").notNull().references(() => referralCodes.id),
    // Who referred (owner of the code)
    referrerId: text("referrer_id").references(() => portalUsers.id),
    // Who was referred (new portal user)
    referredPortalUserId: text("referred_portal_user_id").references(() => portalUsers.id),
    referredEmail: text("referred_email"), // captured before they sign up
    status: referralStatusEnum("status").notNull().default("pending"),
    // Reward info
    rewardPoints: integer("reward_points").default(0),
    rewardedAt: timestamp("rewarded_at", { withTimezone: true }),
    // Qualification details
    qualifiedAt: timestamp("qualified_at", { withTimezone: true }),
    qualificationNotes: text("qualification_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("referrals_tenant_idx").on(t.tenantId),
    index("referrals_referrer_idx").on(t.referrerId),
    index("referrals_code_idx").on(t.referralCodeId),
  ]
);

// ── Reward Accounts ────────────────────────────────────────────────────────
export const rewardAccounts = pgTable(
  "reward_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    portalUserId: text("portal_user_id").notNull().unique().references(() => portalUsers.id, { onDelete: "cascade" }),
    // Balance must never go below 0 (enforced by DB constraint + application logic)
    balance: integer("balance").notNull().default(0),
    lifetimeEarned: integer("lifetime_earned").notNull().default(0),
    lifetimeRedeemed: integer("lifetime_redeemed").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    check("reward_accounts_balance_check", sql`${t.balance} >= 0`),
    index("reward_accounts_tenant_idx").on(t.tenantId),
  ]
);

// ── Reward Transactions ────────────────────────────────────────────────────
export const rewardTransactions = pgTable(
  "reward_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").notNull().references(() => rewardAccounts.id, { onDelete: "cascade" }),
    type: rewardTransactionTypeEnum("type").notNull(),
    points: integer("points").notNull(), // positive for credit, negative for debit
    balanceAfter: integer("balance_after").notNull(),
    description: text("description").notNull(),
    referralId: uuid("referral_id").references(() => referrals.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("reward_transactions_account_idx").on(t.accountId),
    index("reward_transactions_tenant_idx").on(t.tenantId),
  ]
);

// ── Relations ──────────────────────────────────────────────────────────────
export const referralCodesRelations = relations(referralCodes, ({ one, many }) => ({
  tenant: one(tenants, { fields: [referralCodes.tenantId], references: [tenants.id] }),
  portalUser: one(portalUsers, { fields: [referralCodes.portalUserId], references: [portalUsers.id] }),
  referrals: many(referrals),
}));

export const referralsRelations = relations(referrals, ({ one }) => ({
  tenant: one(tenants, { fields: [referrals.tenantId], references: [tenants.id] }),
  code: one(referralCodes, { fields: [referrals.referralCodeId], references: [referralCodes.id] }),
  referrer: one(portalUsers, { fields: [referrals.referrerId], references: [portalUsers.id] }),
}));

export const rewardAccountsRelations = relations(rewardAccounts, ({ one, many }) => ({
  tenant: one(tenants, { fields: [rewardAccounts.tenantId], references: [tenants.id] }),
  portalUser: one(portalUsers, { fields: [rewardAccounts.portalUserId], references: [portalUsers.id] }),
  transactions: many(rewardTransactions),
}));

export const rewardTransactionsRelations = relations(rewardTransactions, ({ one }) => ({
  account: one(rewardAccounts, { fields: [rewardTransactions.accountId], references: [rewardAccounts.id] }),
  referral: one(referrals, { fields: [rewardTransactions.referralId], references: [referrals.id] }),
}));
