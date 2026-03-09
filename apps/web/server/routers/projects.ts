import { z } from "zod";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../trpc";
import { db } from "@synccorehub/database/client";
import { projects, milestones, tasks, taskAssignments, taskComments } from "@synccorehub/database/schema";
import { createProjectSchema } from "@synccorehub/types";
import { eventBus } from "@synccorehub/plugins/hooks";

export const projectsRouter = router({
  // ── List ──────────────────────────────────────────────────────────────
  list: tenantProcedure
    .input(
      z.object({
        page: z.number().default(1),
        limit: z.number().default(25),
        status: z.enum(["planning", "active", "on_hold", "review", "completed", "canceled"]).optional(),
        customerId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(projects.tenantId, ctx.tenantId),
        isNull(projects.deletedAt),
        ...(input.status ? [eq(projects.status, input.status)] : []),
        ...(input.customerId ? [eq(projects.customerId, input.customerId)] : []),
      ];

      const [data, [{ count }]] = await Promise.all([
        db
          .select()
          .from(projects)
          .where(and(...conditions))
          .orderBy(desc(projects.updatedAt))
          .limit(input.limit)
          .offset((input.page - 1) * input.limit),
        db.select({ count: sql<number>`count(*)::int` }).from(projects).where(and(...conditions)),
      ]);

      return { data, total: count, page: input.page, limit: input.limit };
    }),

  // ── Get with milestones & tasks ────────────────────────────────────────
  byId: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [project] = await db
        .select()
        .from(projects)
        .where(
          and(eq(projects.id, input.id), eq(projects.tenantId, ctx.tenantId), isNull(projects.deletedAt))
        )
        .limit(1);

      if (!project) throw new TRPCError({ code: "NOT_FOUND" });

      const [projectMilestones, projectTasks] = await Promise.all([
        db
          .select()
          .from(milestones)
          .where(eq(milestones.projectId, input.id))
          .orderBy(asc(milestones.position)),
        db
          .select()
          .from(tasks)
          .where(and(eq(tasks.projectId, input.id), isNull(tasks.deletedAt)))
          .orderBy(asc(tasks.position)),
      ]);

      return { ...project, milestones: projectMilestones, tasks: projectTasks };
    }),

  // ── Create ────────────────────────────────────────────────────────────
  create: tenantProcedure
    .input(createProjectSchema)
    .mutation(async ({ ctx, input }) => {
      const [project] = await db
        .insert(projects)
        .values({ ...input, tenantId: ctx.tenantId, ownerId: ctx.userId })
        .returning();

      return project!;
    }),

  // ── Update status ─────────────────────────────────────────────────────
  updateStatus: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["planning", "active", "on_hold", "review", "completed", "canceled"]),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await db
        .select({ status: projects.status, customerId: projects.customerId })
        .from(projects)
        .where(and(eq(projects.id, input.id), eq(projects.tenantId, ctx.tenantId)))
        .limit(1);

      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const [updated] = await db
        .update(projects)
        .set({
          status: input.status,
          updatedAt: new Date(),
          ...(input.status === "completed" ? { completedAt: new Date(), progress: 100 } : {}),
        })
        .where(and(eq(projects.id, input.id), eq(projects.tenantId, ctx.tenantId)))
        .returning();

      await eventBus.emit("portal:project-status-changed", {
        tenantId: ctx.tenantId,
        projectId: input.id,
        from: existing.status,
        to: input.status,
        customerId: existing.customerId ?? undefined,
      });

      return updated!;
    }),

  // ── Update progress ───────────────────────────────────────────────────
  updateProgress: tenantProcedure
    .input(z.object({ id: z.string().uuid(), progress: z.number().min(0).max(100) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(projects)
        .set({ progress: input.progress, manualProgress: true, updatedAt: new Date() })
        .where(and(eq(projects.id, input.id), eq(projects.tenantId, ctx.tenantId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  // ── Tasks CRUD ────────────────────────────────────────────────────────
  createTask: tenantProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        title: z.string().min(1),
        description: z.string().optional(),
        status: z.enum(["backlog", "todo", "in_progress", "review", "done", "canceled"]).default("todo"),
        priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
        milestoneId: z.string().uuid().optional(),
        estimatedHours: z.number().optional(),
        dueDate: z.string().datetime().optional(),
        visibleInPortal: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [{ maxPos }] = await db
        .select({ maxPos: sql<number>`coalesce(max(position), 0)` })
        .from(tasks)
        .where(and(eq(tasks.projectId, input.projectId), eq(tasks.status, input.status)));

      const [task] = await db
        .insert(tasks)
        .values({ ...input, tenantId: ctx.tenantId, position: maxPos + 1000 })
        .returning();

      return task!;
    }),

  updateTaskStatus: tenantProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        status: z.enum(["backlog", "todo", "in_progress", "review", "done", "canceled"]),
        position: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(tasks)
        .set({ status: input.status, ...(input.position ? { position: input.position } : {}), updatedAt: new Date() })
        .where(and(eq(tasks.id, input.taskId), eq(tasks.tenantId, ctx.tenantId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      if (input.status === "done") {
        await eventBus.emit("portal:task-completed", {
          tenantId: ctx.tenantId,
          projectId: updated.projectId,
          taskId: input.taskId,
          title: updated.title,
        });
      }

      return updated;
    }),

  // ── Milestones ────────────────────────────────────────────────────────
  completeMilestone: tenantProcedure
    .input(z.object({ milestoneId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(milestones)
        .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(milestones.id, input.milestoneId), eq(milestones.tenantId, ctx.tenantId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      await eventBus.emit("portal:milestone-completed", {
        tenantId: ctx.tenantId,
        projectId: updated.projectId,
        milestoneId: input.milestoneId,
        name: updated.name,
      });

      return updated;
    }),
});
