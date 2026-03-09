import { headers } from "next/headers";
import { PortalNav } from "@/components/layout/portal-nav";
import { db } from "@synccorehub/database/client";
import { tenants } from "@synccorehub/database/schema";
import { eq } from "drizzle-orm";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id");

  let tenantName: string | undefined;
  if (tenantId) {
    const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    tenantName = tenant?.name;
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalNav tenantName={tenantName} />
      <main className="max-w-5xl mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
