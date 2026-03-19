import { eq, and, isNull, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

/**
 * Returns a WHERE clause that combines tenant_id filtering with soft-delete filtering.
 *
 * Usage:
 *   db.select().from(customers).where(tenantFilter(customers, tenantId))
 */
export function tenantFilter<
  T extends { tenantId: PgColumn; deletedAt?: PgColumn }
>(table: T, tenantId: string): SQL {
  const conditions: SQL[] = [eq(table.tenantId, tenantId)];

  if ("deletedAt" in table && table.deletedAt) {
    conditions.push(isNull(table.deletedAt));
  }

  return conditions.length === 1 ? conditions[0]! : and(...conditions)!;
}

/**
 * Validates that a record belongs to the given tenant.
 * Throws if it doesn't (prevents tenant data leakage).
 */
export function assertTenantOwnership(
  record: { tenantId: string } | null | undefined,
  tenantId: string,
  resourceName = "resource"
): asserts record is { tenantId: string } {
  if (!record) {
    throw new TenantAccessError(`${resourceName} not found`);
  }
  if (record.tenantId !== tenantId) {
    throw new TenantAccessError(`Access denied: ${resourceName} does not belong to this tenant`);
  }
}

export class TenantAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantAccessError";
  }
}
