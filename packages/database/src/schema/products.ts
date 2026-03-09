import { relations } from "drizzle-orm";
import {
  boolean,
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
export const productTypeEnum = pgEnum("product_type", [
  "service",
  "product",
  "subscription",
  "addon",
]);

export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "active",
  "archived",
]);

// ── Products ───────────────────────────────────────────────────────────────
export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    shortDescription: text("short_description"),
    type: productTypeEnum("type").notNull().default("service"),
    status: productStatusEnum("status").notNull().default("draft"),
    // Pricing
    priceCents: integer("price_cents").notNull().default(0),
    currency: text("currency").default("USD"),
    billingCycle: text("billing_cycle"), // "one_time" | "monthly" | "yearly" | "custom"
    // Display
    imageUrl: text("image_url"),
    thumbnailUrl: text("thumbnail_url"),
    tags: text("tags").array().default([]),
    features: text("features").array().default([]), // Bullet points
    // Portal visibility
    showInPortal: boolean("show_in_portal").default(true),
    // Stripe
    stripeProductId: text("stripe_product_id"),
    stripePriceId: text("stripe_price_id"),
    // Metadata
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    sortOrder: integer("sort_order").default(0),
    createdById: text("created_by_id").references(() => user.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("products_tenant_idx").on(t.tenantId),
    index("products_status_idx").on(t.tenantId, t.status),
  ]
);

// ── Relations ──────────────────────────────────────────────────────────────
export const productsRelations = relations(products, ({ one }) => ({
  tenant: one(tenants, { fields: [products.tenantId], references: [tenants.id] }),
}));
