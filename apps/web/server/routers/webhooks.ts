import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../trpc";
import { db } from "@synccorehub/database/client";
import { webhooks, webhookDeliveries } from "@synccorehub/database/schema";
import { createWebhookSchema } from "@synccorehub/types";
import { randomBytes } from "crypto";
import { nanoid } from "nanoid";

export const webhooksRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    return db.select().from(webhooks).where(eq(webhooks.tenantId, ctx.tenantId));
  }),

  create: tenantProcedure
    .input(z.object({
      url: z.string().url(),
      events: z.array(z.string()).min(1),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const signingSecret = randomBytes(32).toString("hex");
      const urlHost = (() => { try { return new URL(input.url).hostname; } catch { return input.url.slice(0, 50); } })();
      const [webhook] = await db.insert(webhooks).values({
        url: input.url,
        name: input.description ?? urlHost,
        events: input.events,
        tenantId: ctx.tenantId,
        createdById: ctx.userId,
        signingSecret,
        status: "active",
      }).returning();
      return { ...webhook!, signingSecret };
    }),

  delete: tenantProcedure
    .input(z.object({ webhookId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(webhooks).where(and(eq(webhooks.id, input.webhookId), eq(webhooks.tenantId, ctx.tenantId)));
      return { success: true };
    }),

  listDeliveries: tenantProcedure
    .input(z.object({ webhookId: z.string().uuid(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      return db.select().from(webhookDeliveries).where(and(eq(webhookDeliveries.webhookId, input.webhookId), eq(webhookDeliveries.tenantId, ctx.tenantId))).orderBy(desc(webhookDeliveries.createdAt)).limit(input.limit);
    }),

  // Manually retry a failed delivery
  retryDelivery: tenantProcedure
    .input(z.object({ deliveryId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [delivery] = await db.select().from(webhookDeliveries).where(and(eq(webhookDeliveries.id, input.deliveryId), eq(webhookDeliveries.tenantId, ctx.tenantId))).limit(1);
      if (!delivery) throw new TRPCError({ code: "NOT_FOUND" });

      await db.update(webhookDeliveries).set({ status: "pending", nextRetryAt: new Date(), attemptCount: 0 }).where(eq(webhookDeliveries.id, input.deliveryId));

      // TODO: Enqueue retry job in BullMQ
      return { success: true };
    }),
});
