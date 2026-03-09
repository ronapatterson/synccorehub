import { z } from "zod";
import { and, count, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../trpc";
import { db } from "@synccorehub/database/client";
import { segments, customerSegmentMembers } from "@synccorehub/database/schema";

export const segmentsRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    return db
      .select({
        id: segments.id,
        name: segments.name,
        description: segments.description,
        segmentType: segments.type,
        color: segments.color,
        createdAt: segments.createdAt,
        updatedAt: segments.updatedAt,
        memberCount: count(customerSegmentMembers.customerId),
      })
      .from(segments)
      .leftJoin(customerSegmentMembers, eq(customerSegmentMembers.segmentId, segments.id))
      .where(and(eq(segments.tenantId, ctx.tenantId), isNull(segments.deletedAt)))
      .groupBy(
        segments.id,
        segments.name,
        segments.description,
        segments.type,
        segments.color,
        segments.createdAt,
        segments.updatedAt,
      );
  }),

  create: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        segmentType: z.enum(["static", "dynamic"]).default("static"),
        filterRules: z.unknown().optional(),
        color: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { segmentType, ...rest } = input;
      const [seg] = await db
        .insert(segments)
        .values({ ...rest, type: segmentType, filterRules: input.filterRules as never, tenantId: ctx.tenantId, createdById: ctx.userId })
        .returning();
      return seg!;
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [seg] = await db.select({ id: segments.id }).from(segments).where(and(eq(segments.id, input.id), eq(segments.tenantId, ctx.tenantId))).limit(1);
      if (!seg) throw new TRPCError({ code: "NOT_FOUND" });
      await db.update(segments).set({ deletedAt: new Date() }).where(eq(segments.id, input.id));
    }),

  addMember: tenantProcedure
    .input(z.object({ segmentId: z.string().uuid(), customerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [seg] = await db.select({ id: segments.id }).from(segments).where(and(eq(segments.id, input.segmentId), eq(segments.tenantId, ctx.tenantId))).limit(1);
      if (!seg) throw new TRPCError({ code: "NOT_FOUND" });
      await db.insert(customerSegmentMembers).values(input).onConflictDoNothing();
      return { success: true };
    }),

  removeMember: tenantProcedure
    .input(z.object({ segmentId: z.string().uuid(), customerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(customerSegmentMembers)
        .where(and(eq(customerSegmentMembers.segmentId, input.segmentId), eq(customerSegmentMembers.customerId, input.customerId)));
      return { success: true };
    }),
});
