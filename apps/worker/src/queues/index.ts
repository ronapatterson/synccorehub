import { Queue, type ConnectionOptions } from "bullmq";
import Redis from "ioredis";

// Cast as ConnectionOptions — ioredis and bullmq ship separate IORedis type declarations
// that are structurally incompatible. Runtime behavior is identical.
export const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
}) as unknown as ConnectionOptions;

// ── Queue definitions ──────────────────────────────────────────────────────
export const icpScoringQueue = new Queue("icp-scoring", { connection });
export const webhookDeliveryQueue = new Queue("webhook-delivery", { connection });
export const emailQueue = new Queue("email", { connection });
export const referralQualificationQueue = new Queue("referral-qualification", { connection });

// ── Call Routing Queues ────────────────────────────────────────────────────
export const callRoutingSmsQueue = new Queue("call-routing-sms", { connection });
export const appointmentConfirmationQueue = new Queue("appointment-confirmation", { connection });

// Job type definitions
export type IcpScoringJob = { tenantId: string; profileId: string };
export type WebhookDeliveryJob = { deliveryId: string; webhookId: string; tenantId: string };
export type EmailJob = { template: string; to: string; data: Record<string, unknown> };
export type ReferralQualificationJob = { referralId: string; tenantId: string };

export type SendSchedulingSmsJob = {
  tenantId: string;
  missedCallLogId: string;
  virtualNumberId: string;
  callerPhone: string;
  callerName: string | null;
};

export type SendAppointmentConfirmationJob = {
  tenantId: string;
  appointmentId: string;
  scheduledAt: string; // ISO
  recipientUserId: string;
  callerPhone: string;
  callerName: string | null;
};
