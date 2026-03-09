import { z } from "zod";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../trpc";
import { db } from "@synccorehub/database/client";
import { leads, pipelineStages, pipelines, leadStageHistory } from "@synccorehub/database/schema";
import { createLeadSchema } from "@synccorehub/types";
import { eventBus } from "@synccorehub/plugins/hooks";

export const leadsRouter = router({
  // ── List all pipelines with stages + leads ─────────────────────────────
  pipelinesWithLeads: tenantProcedure.query(async ({ ctx }) => {
    const allPipelines = await db
      .select()
      .from(pipelines)
      .where(and(eq(pipelines.tenantId, ctx.tenantId), isNull(pipelines.deletedAt)));

    const allStages = await db
      .select()
      .from(pipelineStages)
      .where(and(eq(pipelineStages.tenantId, ctx.tenantId), isNull(pipelineStages.deletedAt)))
      .orderBy(asc(pipelineStages.position));

    const allLeads = await db
      .select()
      .from(leads)
      .where(and(eq(leads.tenantId, ctx.tenantId), eq(leads.status, "open"), isNull(leads.deletedAt)))
      .orderBy(asc(leads.position));

    return allPipelines.map((pipeline) => ({
      ...pipeline,
      stages: allStages
        .filter((s) => s.pipelineId === pipeline.id)
        .map((stage) => ({
          ...stage,
          leads: allLeads.filter((l) => l.stageId === stage.id),
        })),
    }));
  }),

  // ── Move lead to new stage ────────────────────────────────────────────
  moveToStage: tenantProcedure
    .input(
      z.object({
        leadId: z.string().uuid(),
        toStageId: z.string().uuid(),
        position: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select()
        .from(leads)
        .where(and(eq(leads.id, input.leadId), eq(leads.tenantId, ctx.tenantId)))
        .limit(1);

      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const [updated] = await db
        .update(leads)
        .set({
          stageId: input.toStageId,
          position: input.position,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(leads.id, input.leadId), eq(leads.tenantId, ctx.tenantId)))
        .returning();

      // Record stage history
      await db.insert(leadStageHistory).values({
        leadId: input.leadId,
        tenantId: ctx.tenantId,
        fromStageId: existing.stageId,
        toStageId: input.toStageId,
        changedById: ctx.userId,
      });

      await eventBus.emit("crm:lead-stage-changed", {
        tenantId: ctx.tenantId,
        leadId: input.leadId,
        fromStageId: existing.stageId,
        toStageId: input.toStageId,
      });

      return updated!;
    }),

  // ── Create pipeline ───────────────────────────────────────────────────
  createPipeline: tenantProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const [pipeline] = await db
        .insert(pipelines)
        .values({ name: input.name, tenantId: ctx.tenantId })
        .returning();

      // Create default stages
      await db.insert(pipelineStages).values([
        { pipelineId: pipeline!.id, tenantId: ctx.tenantId, name: "New", position: 1000, winProbability: 10 },
        { pipelineId: pipeline!.id, tenantId: ctx.tenantId, name: "Qualified", position: 2000, winProbability: 30 },
        { pipelineId: pipeline!.id, tenantId: ctx.tenantId, name: "Proposal", position: 3000, winProbability: 60 },
        { pipelineId: pipeline!.id, tenantId: ctx.tenantId, name: "Negotiation", position: 4000, winProbability: 80 },
        { pipelineId: pipeline!.id, tenantId: ctx.tenantId, name: "Closed Won", position: 5000, winProbability: 100 },
      ]);

      return pipeline!;
    }),

  // ── Create lead ───────────────────────────────────────────────────────
  create: tenantProcedure
    .input(createLeadSchema)
    .mutation(async ({ ctx, input }) => {
      // Get max position in stage for ordering
      const [{ maxPos }] = await db
        .select({ maxPos: sql<number>`coalesce(max(position), 0)` })
        .from(leads)
        .where(and(eq(leads.stageId, input.stageId), eq(leads.tenantId, ctx.tenantId)));

      const [lead] = await db
        .insert(leads)
        .values({
          ...input,
          tenantId: ctx.tenantId,
          ownerId: input.ownerId ?? ctx.userId,
          position: maxPos + 1000,
          lastActivityAt: new Date(),
        })
        .returning();

      await eventBus.emit("crm:lead-created", {
        tenantId: ctx.tenantId,
        leadId: lead!.id,
        title: lead!.title,
        value: lead!.value ?? undefined,
      });

      return lead!;
    }),

  // ── Mark won / lost ───────────────────────────────────────────────────
  markWon: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(leads)
        .set({ status: "won", updatedAt: new Date() })
        .where(and(eq(leads.id, input.id), eq(leads.tenantId, ctx.tenantId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      await eventBus.emit("crm:lead-won", {
        tenantId: ctx.tenantId,
        leadId: input.id,
        value: updated.value ?? undefined,
      });

      return updated;
    }),

  markLost: tenantProcedure
    .input(z.object({ id: z.string().uuid(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(leads)
        .set({ status: "lost", updatedAt: new Date() })
        .where(and(eq(leads.id, input.id), eq(leads.tenantId, ctx.tenantId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      await eventBus.emit("crm:lead-lost", {
        tenantId: ctx.tenantId,
        leadId: input.id,
        reason: input.reason,
      });

      return updated;
    }),
});
