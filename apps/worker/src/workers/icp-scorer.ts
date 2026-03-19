/**
 * ICP Scoring Worker
 * Recomputes icpScore for all customers in a tenant against a given ICP profile.
 * Each criterion contributes points if it matches the customer's field value.
 */
import { Worker, type ConnectionOptions } from "bullmq";
import Redis from "ioredis";
import { db } from "@synccorehub/database/client";
import { customers, icpCriteria } from "@synccorehub/database/schema";
import { and, eq, isNull } from "drizzle-orm";
import type { IcpScoringJob } from "../queues";

type Criterion = typeof icpCriteria.$inferSelect;
type Customer = typeof customers.$inferSelect;

function evaluateCriterion(criterion: Criterion, customer: Customer): number {
  const fieldMap: Record<string, string | null | undefined> = {
    industry: customer.industry,
    company_size: customer.companySize,
    annual_revenue: customer.annualRevenue,
    country: customer.country,
    job_title: customer.jobTitle,
  };

  const value = fieldMap[criterion.field];
  if (value == null) return 0;

  const criterionValue = criterion.value;

  switch (criterion.operator) {
    case "eq":
      return String(value).toLowerCase() === String(criterionValue).toLowerCase()
        ? criterion.pointsIfMatch
        : 0;
    case "in":
      return Array.isArray(criterionValue) &&
        criterionValue.some((v: string) => v.toLowerCase() === value.toLowerCase())
        ? criterion.pointsIfMatch
        : 0;
    case "contains":
      return value.toLowerCase().includes(String(criterionValue).toLowerCase())
        ? criterion.pointsIfMatch
        : 0;
    default:
      return 0;
  }
}

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
}) as unknown as ConnectionOptions;

export const icpScorerWorker = new Worker<IcpScoringJob>(
  "icp-scoring",
  async (job) => {
    const { tenantId, profileId } = job.data;
    console.log(`[ICP Scorer] Rescoring tenant ${tenantId}, profile ${profileId}`);

    // Load criteria
    const criteria = await db
      .select()
      .from(icpCriteria)
      .where(and(eq(icpCriteria.profileId, profileId), eq(icpCriteria.tenantId, tenantId), eq(icpCriteria.isActive, true)));

    if (criteria.length === 0) {
      console.log(`[ICP Scorer] No active criteria for profile ${profileId}`);
      return;
    }

    const maxPossibleScore = criteria.reduce((sum, c) => sum + c.weight, 0);

    // Process customers in batches of 100
    let offset = 0;
    const batchSize = 100;

    while (true) {
      const batch = await db
        .select()
        .from(customers)
        .where(and(eq(customers.tenantId, tenantId), isNull(customers.deletedAt)))
        .limit(batchSize)
        .offset(offset);

      if (batch.length === 0) break;

      for (const customer of batch) {
        let totalPoints = 0;
        for (const criterion of criteria) {
          totalPoints += evaluateCriterion(criterion, customer);
        }

        const score = maxPossibleScore > 0
          ? Math.min(100, (totalPoints / maxPossibleScore) * 100)
          : 0;

        await db
          .update(customers)
          .set({ icpScore: score, icpProfileId: profileId, updatedAt: new Date() })
          .where(eq(customers.id, customer.id));
      }

      offset += batchSize;
      await job.updateProgress(Math.round((offset / (offset + batchSize)) * 100));
    }

    console.log(`[ICP Scorer] Done rescoring profile ${profileId}`);
  },
  { connection, concurrency: 2 }
);
