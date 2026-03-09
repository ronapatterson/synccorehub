import { Queue } from "bullmq";
import Redis from "ioredis";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null, // Required for BullMQ
});

// ── Queue definitions ──────────────────────────────────────────────────────
export const icpScoringQueue = new Queue("icp-scoring", { connection });
export const webhookDeliveryQueue = new Queue("webhook-delivery", { connection });
export const emailQueue = new Queue("email", { connection });
export const referralQualificationQueue = new Queue("referral-qualification", { connection });

// Job type definitions
export type IcpScoringJob = { tenantId: string; profileId: string };
export type WebhookDeliveryJob = { deliveryId: string; webhookId: string; tenantId: string };
export type EmailJob = { template: string; to: string; data: Record<string, unknown> };
export type ReferralQualificationJob = { referralId: string; tenantId: string };
