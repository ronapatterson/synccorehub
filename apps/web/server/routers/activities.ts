import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { router, tenantProcedure } from "../trpc";
import { db } from "@synccorehub/database/client";
import { activities } from "@synccorehub/database/schema";

export const activitiesRouter = router({
  create: tenantProcedure
    .input(z.object({
      type: z.enum(["note", "call", "email", "meeting", "demo", "task", "custom"]),
      title: z.string().optional(),
      content: z.string().optional(),
      customerId: z.string().uuid().optional(),
      leadId: z.string().uuid().optional(),
      projectId: z.string().uuid().optional(),
      occurredAt: z.string().datetime().optional(),
      durationMinutes: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [activity] = await db.insert(activities).values({
        ...input,
        tenantId: ctx.tenantId,
        createdById: ctx.userId,
        occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
      }).returning();
      return activity!;
    }),

  list: tenantProcedure
    .input(z.object({ customerId: z.string().uuid().optional(), leadId: z.string().uuid().optional(), projectId: z.string().uuid().optional(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      const conditions = [eq(activities.tenantId, ctx.tenantId), ...(input.customerId ? [eq(activities.customerId, input.customerId)] : []), ...(input.leadId ? [eq(activities.leadId, input.leadId)] : []), ...(input.projectId ? [eq(activities.projectId, input.projectId)] : [])];
      return db.select().from(activities).where(and(...conditions)).orderBy(desc(activities.occurredAt)).limit(input.limit);
    }),
});
