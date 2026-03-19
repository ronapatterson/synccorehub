import { z } from "zod";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../trpc";
import { db } from "@synccorehub/database/client";
import { contractors, timeEntries, taskAssignments } from "@synccorehub/database/schema";
import { createContractorSchema } from "@synccorehub/types";
import { eventBus } from "@synccorehub/plugins/hooks";

export const contractorsRouter = router({
  list: tenantProcedure
    .input(z.object({ page: z.number().default(1), limit: z.number().default(50), search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(contractors.tenantId, ctx.tenantId),
        isNull(contractors.deletedAt),
        ...(input.search
          ? [or(ilike(contractors.name, `%${input.search}%`), ilike(contractors.email, `%${input.search}%`))!]
          : []),
      ];
      return db.select().from(contractors).where(and(...conditions)).orderBy(desc(contractors.createdAt)).limit(input.limit).offset((input.page - 1) * input.limit);
    }),

  byId: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [c] = await db.select().from(contractors).where(and(eq(contractors.id, input.id), eq(contractors.tenantId, ctx.tenantId), isNull(contractors.deletedAt))).limit(1);
      if (!c) throw new TRPCError({ code: "NOT_FOUND" });
      return c;
    }),

  create: tenantProcedure
    .input(createContractorSchema)
    .mutation(async ({ ctx, input }) => {
      const [c] = await db.insert(contractors).values({ ...input, tenantId: ctx.tenantId }).returning();
      return c!;
    }),

  update: tenantProcedure
    .input(z.object({ id: z.string().uuid(), data: createContractorSchema.partial() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db.update(contractors).set({ ...input.data, updatedAt: new Date() }).where(and(eq(contractors.id, input.id), eq(contractors.tenantId, ctx.tenantId))).returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  // ── Task assignment ─────────────────────────────────────────────────────
  assignToTask: tenantProcedure
    .input(z.object({ contractorId: z.string().uuid(), taskId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [assignment] = await db.insert(taskAssignments).values({ taskId: input.taskId, contractorId: input.contractorId }).returning();
      await eventBus.emit("contractor:assigned", { tenantId: ctx.tenantId, contractorId: input.contractorId, taskId: input.taskId });
      return assignment!;
    }),

  // ── Time entries ────────────────────────────────────────────────────────
  listTimeEntries: tenantProcedure
    .input(z.object({ contractorId: z.string().uuid().optional(), status: z.enum(["draft", "submitted", "approved", "rejected", "invoiced"]).optional(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(timeEntries.tenantId, ctx.tenantId),
        ...(input.contractorId ? [eq(timeEntries.contractorId, input.contractorId)] : []),
        ...(input.status ? [eq(timeEntries.status, input.status)] : []),
      ];
      return db.select().from(timeEntries).where(and(...conditions)).orderBy(desc(timeEntries.startedAt)).limit(input.limit);
    }),

  logTimeEntry: tenantProcedure
    .input(z.object({ contractorId: z.string().uuid(), taskId: z.string().uuid().optional(), description: z.string().optional(), startedAt: z.string(), endedAt: z.string().optional(), durationMinutes: z.number().optional(), billable: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const { billable, ...rest } = input;
      const [entry] = await db.insert(timeEntries).values({
        ...rest,
        startedAt: new Date(input.startedAt),
        endedAt: input.endedAt ? new Date(input.endedAt) : undefined,
        isBillable: billable,
        status: "submitted",
        tenantId: ctx.tenantId,
      }).returning();
      await eventBus.emit("contractor:time-entry-submitted", { tenantId: ctx.tenantId, contractorId: input.contractorId, timeEntryId: entry!.id });
      return entry!;
    }),

  approveTimeEntry: tenantProcedure
    .input(z.object({ timeEntryId: z.string().uuid(), approved: z.boolean().default(true), rejectionReason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const newStatus = input.approved ? "approved" : "rejected";
      const [updated] = await db.update(timeEntries).set({
        status: newStatus,
        approvedById: input.approved ? ctx.userId : undefined,
        approvedAt: input.approved ? new Date() : undefined,
        rejectionReason: !input.approved ? (input.rejectionReason ?? "Rejected") : undefined,
        updatedAt: new Date(),
      }).where(and(eq(timeEntries.id, input.timeEntryId), eq(timeEntries.tenantId, ctx.tenantId))).returning();
      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      if (input.approved) {
        await eventBus.emit("contractor:time-entry-approved", { tenantId: ctx.tenantId, contractorId: updated.contractorId, timeEntryId: input.timeEntryId });
      }
      return updated;
    }),
});
