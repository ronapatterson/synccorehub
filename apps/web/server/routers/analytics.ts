import { and, count, eq, gte, isNull, sql, sum } from "drizzle-orm";
import { router, tenantProcedure } from "../trpc";
import { db } from "@synccorehub/database/client";
import { customers, leads, projects } from "@synccorehub/database/schema";
import { subDays } from "date-fns";

export const analyticsRouter = router({
  dashboardKpis: tenantProcedure.query(async ({ ctx }) => {
    const tenantId = ctx.tenantId;

    const [
      [{ totalCustomers }],
      [{ icpMatched }],
      [{ openLeads }],
      [{ pipelineValue }],
      [{ activeProjects }],
    ] = await Promise.all([
      db.select({ totalCustomers: count() }).from(customers).where(and(eq(customers.tenantId, tenantId), isNull(customers.deletedAt))),
      db.select({ icpMatched: count() }).from(customers).where(and(eq(customers.tenantId, tenantId), isNull(customers.deletedAt), sql`${customers.icpScore} >= 70`)),
      db.select({ openLeads: count() }).from(leads).where(and(eq(leads.tenantId, tenantId), eq(leads.status, "open"), isNull(leads.deletedAt))),
      db.select({ pipelineValue: sum(leads.value) }).from(leads).where(and(eq(leads.tenantId, tenantId), eq(leads.status, "open"))),
      db.select({ activeProjects: count() }).from(projects).where(and(eq(projects.tenantId, tenantId), eq(projects.status, "active"), isNull(projects.deletedAt))),
    ]);

    return {
      totalCustomers,
      icpMatchedCount: icpMatched,
      icpMatchedPct: totalCustomers > 0 ? Math.round((icpMatched / totalCustomers) * 100) : 0,
      openLeads,
      pipelineValue: Number(pipelineValue ?? 0),
      activeProjects,
    };
  }),

  icpScoreDistribution: tenantProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({
        bucket: sql<string>`
          CASE
            WHEN ${customers.icpScore} IS NULL THEN 'Unscored'
            WHEN ${customers.icpScore} < 25 THEN '0–24'
            WHEN ${customers.icpScore} < 50 THEN '25–49'
            WHEN ${customers.icpScore} < 75 THEN '50–74'
            ELSE '75–100'
          END
        `,
        count: count(),
      })
      .from(customers)
      .where(and(eq(customers.tenantId, ctx.tenantId), isNull(customers.deletedAt)))
      .groupBy(sql`1`);

    return rows;
  }),

  leadVelocity: tenantProcedure.query(async ({ ctx }) => {
    // Won leads grouped by week over last 12 weeks
    const rows = await db
      .select({
        week: sql<string>`date_trunc('week', ${leads.updatedAt})::text`,
        count: count(),
        value: sum(leads.value),
      })
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, ctx.tenantId),
          eq(leads.status, "won"),
          gte(leads.updatedAt, subDays(new Date(), 84))
        )
      )
      .groupBy(sql`1`)
      .orderBy(sql`1`);

    return rows;
  }),
});
