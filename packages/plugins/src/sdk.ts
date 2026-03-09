/**
 * Plugin SDK — type-safe, tenant-scoped data access for plugin developers.
 * Plugins use this API to read/write CRM data within their granted scopes.
 */
import { db } from "@synccorehub/database/client";
import {
  customers,
  leads,
  projects,
  products,
  webhooks,
} from "@synccorehub/database/schema";
import { eq, and, isNull } from "drizzle-orm";

export type PluginScope =
  | "customers:read"
  | "customers:write"
  | "leads:read"
  | "leads:write"
  | "projects:read"
  | "analytics:read"
  | "webhooks:manage";

export class PluginAPI {
  constructor(
    private readonly tenantId: string,
    private readonly scopes: PluginScope[]
  ) {}

  private requireScope(scope: PluginScope): void {
    if (!this.scopes.includes(scope)) {
      throw new Error(`Plugin does not have scope "${scope}"`);
    }
  }

  // ── Customers ──────────────────────────────────────────────────────────
  readonly customers = {
    list: async (limit = 50) => {
      this.requireScope("customers:read");
      return db
        .select()
        .from(customers)
        .where(and(eq(customers.tenantId, this.tenantId), isNull(customers.deletedAt)))
        .limit(Math.min(limit, 200));
    },

    get: async (customerId: string) => {
      this.requireScope("customers:read");
      const [record] = await db
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.id, customerId),
            eq(customers.tenantId, this.tenantId),
            isNull(customers.deletedAt)
          )
        )
        .limit(1);
      return record ?? null;
    },
  };

  // ── Leads ──────────────────────────────────────────────────────────────
  readonly leads = {
    list: async (limit = 50) => {
      this.requireScope("leads:read");
      return db
        .select()
        .from(leads)
        .where(and(eq(leads.tenantId, this.tenantId), isNull(leads.deletedAt)))
        .limit(Math.min(limit, 200));
    },
  };

  // ── Projects ───────────────────────────────────────────────────────────
  readonly projects = {
    list: async (limit = 50) => {
      this.requireScope("projects:read");
      return db
        .select()
        .from(projects)
        .where(and(eq(projects.tenantId, this.tenantId), isNull(projects.deletedAt)))
        .limit(Math.min(limit, 200));
    },
  };

  // ── Webhooks ───────────────────────────────────────────────────────────
  readonly webhooks = {
    register: async (event: string, url: string) => {
      this.requireScope("webhooks:manage");
      const { nanoid } = await import("nanoid");
      const { createHmac, randomBytes } = await import("crypto");
      const signingSecret = randomBytes(32).toString("hex");

      await db.insert(webhooks).values({
        id: nanoid(),
        tenantId: this.tenantId,
        name: `Plugin webhook: ${event}`,
        url,
        events: [event],
        signingSecret,
      });
    },
  };
}

/**
 * Create a PluginAPI instance scoped to a tenant with specific permissions.
 */
export function createPluginAPI(tenantId: string, scopes: PluginScope[]): PluginAPI {
  return new PluginAPI(tenantId, scopes);
}
