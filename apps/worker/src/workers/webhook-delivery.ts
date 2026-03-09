/**
 * Webhook Delivery Worker
 * Delivers webhook events to registered endpoints with HMAC-SHA256 signing.
 * Retries with exponential backoff on failure.
 */
import { Worker } from "bullmq";
import Redis from "ioredis";
import { createHmac } from "crypto";
import { db } from "@synccorehub/database/client";
import { webhooks, webhookDeliveries } from "@synccorehub/database/schema";
import { eq } from "drizzle-orm";
import type { WebhookDeliveryJob } from "../queues";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const webhookDeliveryWorker = new Worker<WebhookDeliveryJob>(
  "webhook-delivery",
  async (job) => {
    const { deliveryId, webhookId } = job.data;

    const [delivery] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, deliveryId)).limit(1);
    const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, webhookId)).limit(1);

    if (!delivery || !webhook) {
      console.error(`[Webhooks] Delivery ${deliveryId} or webhook ${webhookId} not found`);
      return;
    }

    const payload = JSON.stringify(delivery.payload);
    const timestamp = Date.now();
    const signature = createHmac("sha256", webhook.signingSecret)
      .update(`${timestamp}.${payload}`)
      .digest("hex");

    await db.update(webhookDeliveries)
      .set({ status: "retrying", attemptCount: delivery.attemptCount + 1 })
      .where(eq(webhookDeliveries.id, deliveryId));

    try {
      const response = await fetch(webhook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-SyncCoreHub-Signature": `t=${timestamp},v1=${signature}`,
          "X-SyncCoreHub-Event": delivery.event,
          ...webhook.headers,
        },
        body: payload,
        signal: AbortSignal.timeout(30_000), // 30s timeout
      });

      const responseBody = await response.text().catch(() => "");

      if (response.ok) {
        await db.update(webhookDeliveries)
          .set({ status: "success", responseStatusCode: response.status, responseBody, deliveredAt: new Date() })
          .where(eq(webhookDeliveries.id, deliveryId));

        await db.update(webhooks)
          .set({ lastSuccessAt: new Date(), consecutiveFailures: 0 })
          .where(eq(webhooks.id, webhookId));
      } else {
        throw new Error(`HTTP ${response.status}: ${responseBody.slice(0, 200)}`);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const consecutiveFailures = (webhook.consecutiveFailures ?? 0) + 1;

      await db.update(webhookDeliveries)
        .set({ status: "failed", responseBody: errorMsg })
        .where(eq(webhookDeliveries.id, deliveryId));

      await db.update(webhooks)
        .set({ consecutiveFailures, lastFailureAt: new Date(), status: consecutiveFailures >= 10 ? "failing" : "active" })
        .where(eq(webhooks.id, webhookId));

      throw err; // Let BullMQ retry
    }
  },
  {
    connection,
    concurrency: 5,
    settings: {
      backoffStrategy: (attemptsMade) => Math.min(1000 * Math.pow(2, attemptsMade), 60 * 60 * 1000), // Max 1 hour
    },
  }
);
