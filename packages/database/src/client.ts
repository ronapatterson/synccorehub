import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Connection pool for application queries
const queryClient = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema, logger: process.env.NODE_ENV === "development" });

export type Database = typeof db;

// ── Tenant-scoped query helper ─────────────────────────────────────────────
// Sets the RLS session variable so PG policies can filter by tenant
export async function withTenantContext<T>(
  tenantId: string,
  fn: () => Promise<T>
): Promise<T> {
  // Use a dedicated single connection for the transaction
  const client = postgres(connectionString!, { max: 1 });
  const scopedDb = drizzle(client, { schema });

  try {
    const result = await scopedDb.transaction(async (tx) => {
      await tx.execute(
        `SELECT set_config('app.current_tenant_id', '${tenantId}', true)`
      );
      return fn();
    });
    return result;
  } finally {
    await client.end();
  }
}

export { schema };
