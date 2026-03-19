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
export const pluginStatusEnum = pgEnum("plugin_status", [
  "active",
  "beta",
  "deprecated",
  "removed",
]);

export const installedPluginStatusEnum = pgEnum("installed_plugin_status", [
  "active",
  "disabled",
  "error",
  "uninstalled",
]);

// ── Plugin Registry ─────────────────────────────────────────────────────────
// Global plugin registry — available to all tenants
export const plugins = pgTable("plugins", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  longDescription: text("long_description"),
  version: text("version").notNull(),
  author: text("author").notNull(),
  authorUrl: text("author_url"),
  iconUrl: text("icon_url"),
  screenshotUrls: text("screenshot_urls").array().default([]),
  // The plugin's API manifest (JSON with hooks, routes, permissions)
  manifest: jsonb("manifest").$type<PluginManifest>().notNull(),
  // What scopes (data access permissions) this plugin requests
  requiredScopes: text("required_scopes").array().default([]),
  // Compatibility
  minApiVersion: text("min_api_version").default("1.0"),
  maxApiVersion: text("max_api_version"),
  status: pluginStatusEnum("status").notNull().default("active"),
  // Marketplace display
  category: text("category"), // "crm", "analytics", "communication", "finance", "productivity"
  tags: text("tags").array().default([]),
  isFeatured: boolean("is_featured").default(false),
  isOfficial: boolean("is_official").default(false),
  // Pricing
  isFree: boolean("is_free").default(true),
  priceCents: text("price_cents"), // null = free
  // Install stats
  installCount: text("install_count").default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PluginManifest = {
  id: string;
  version: string;
  apiVersion: string;
  hooks?: string[]; // Hook event IDs this plugin subscribes to
  routes?: Array<{ path: string; label: string; icon?: string }>; // UI routes plugin adds
  configSchema?: Record<string, { type: string; label: string; required?: boolean; secret?: boolean; placeholder?: string }>;
};

// ── Installed Plugins ──────────────────────────────────────────────────────
// Per-tenant plugin installations
export const installedPlugins = pgTable(
  "installed_plugins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    pluginId: uuid("plugin_id").notNull().references(() => plugins.id),
    status: installedPluginStatusEnum("status").notNull().default("active"),
    installedById: text("installed_by_id").references(() => user.id),
    installedAt: timestamp("installed_at", { withTimezone: true }).defaultNow().notNull(),
    lastEnabledAt: timestamp("last_enabled_at", { withTimezone: true }),
    errorMessage: text("error_message"),
    // Optimistic lock
    version: text("version").notNull().default("1"),
  },
  (t) => [
    index("installed_plugins_tenant_idx").on(t.tenantId),
    index("installed_plugins_plugin_idx").on(t.pluginId),
  ]
);

// ── Plugin Configs ─────────────────────────────────────────────────────────
// Key-value config per tenant per plugin — values AES-256-GCM encrypted in app layer
export const pluginConfigs = pgTable(
  "plugin_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    installedPluginId: uuid("installed_plugin_id").notNull().references(() => installedPlugins.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    // Stored as encrypted ciphertext (AES-256-GCM, base64 encoded)
    encryptedValue: text("encrypted_value"),
    // Non-secret values stored plaintext
    plaintextValue: text("plaintext_value"),
    isSecret: boolean("is_secret").default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("plugin_configs_installed_plugin_idx").on(t.installedPluginId),
  ]
);

// ── Relations ──────────────────────────────────────────────────────────────
export const pluginsRelations = relations(plugins, ({ many }) => ({
  installations: many(installedPlugins),
}));

export const installedPluginsRelations = relations(installedPlugins, ({ one, many }) => ({
  tenant: one(tenants, { fields: [installedPlugins.tenantId], references: [tenants.id] }),
  plugin: one(plugins, { fields: [installedPlugins.pluginId], references: [plugins.id] }),
  configs: many(pluginConfigs),
}));
