import { relations } from "drizzle-orm";
import {
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

// ── Enums ─────────────────────────────────────────────────────────────────
export const apiKeyStatusEnum = pgEnum("api_key_status", [
  "active",
  "revoked",
  "expired",
]);

export const webhookStatusEnum = pgEnum("webhook_status", [
  "active",
  "disabled",
  "failing", // too many consecutive failures
]);

export const webhookDeliveryStatusEnum = pgEnum("webhook_delivery_status", [
  "pending",
  "success",
  "failed",
  "retrying",
]);

// ── API Keys ───────────────────────────────────────────────────────────────
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // The key prefix visible in UI (e.g. "sk_live_abc123...")
    keyPrefix: text("key_prefix").notNull(),
    // HMAC-SHA256 hash of the full key — used for lookup & validation
    keyHash: text("key_hash").notNull().unique(),
    // Scopes this key can access
    scopes: text("scopes").array().default([]),
    status: apiKeyStatusEnum("status").notNull().default("active"),
    createdById: text("created_by_id").references(() => user.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedById: text("revoked_by_id").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("api_keys_tenant_idx").on(t.tenantId),
    index("api_keys_key_hash_idx").on(t.keyHash),
  ]
);

// ── Webhooks ───────────────────────────────────────────────────────────────
export const webhooks = pgTable(
  "webhooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    url: text("url").notNull(),
    // Events this webhook subscribes to
    events: text("events").array().notNull().default([]),
    // HMAC secret for signing payloads (stored encrypted)
    signingSecret: text("signing_secret").notNull(),
    status: webhookStatusEnum("status").notNull().default("active"),
    // Retry config
    maxRetries: integer("max_retries").default(5),
    // Stats
    consecutiveFailures: integer("consecutive_failures").default(0),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    // Metadata
    headers: jsonb("headers").$type<Record<string, string>>().default({}),
    createdById: text("created_by_id").references(() => user.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("webhooks_tenant_idx").on(t.tenantId)]
);

// ── Webhook Deliveries ─────────────────────────────────────────────────────
export const webhookDeliveries = pgTable(
  "webhook_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id").notNull().references(() => webhooks.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    // Event that triggered delivery
    event: text("event").notNull(),
    // Request payload sent
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: webhookDeliveryStatusEnum("status").notNull().default("pending"),
    // Response
    responseStatusCode: integer("response_status_code"),
    responseBody: text("response_body"),
    // Retry tracking
    attemptCount: integer("attempt_count").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("webhook_deliveries_webhook_idx").on(t.webhookId),
    index("webhook_deliveries_status_idx").on(t.status, t.nextRetryAt),
  ]
);

// ── Relations ──────────────────────────────────────────────────────────────
export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  tenant: one(tenants, { fields: [apiKeys.tenantId], references: [tenants.id] }),
}));

export const webhooksRelations = relations(webhooks, ({ one, many }) => ({
  tenant: one(tenants, { fields: [webhooks.tenantId], references: [tenants.id] }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  webhook: one(webhooks, { fields: [webhookDeliveries.webhookId], references: [webhooks.id] }),
  tenant: one(tenants, { fields: [webhookDeliveries.tenantId], references: [tenants.id] }),
}));
