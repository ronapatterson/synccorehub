import { z } from "zod";
import { and, desc, eq, ilike, isNull, or, sql, asc } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../trpc";
import { db } from "@synccorehub/database/client";
import { customers, activities } from "@synccorehub/database/schema";
import { createCustomerSchema } from "@synccorehub/types";
import { eventBus } from "@synccorehub/plugins/hooks";

export const customersRouter = router({
  // ── List ──────────────────────────────────────────────────────────────
  list: tenantProcedure
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(25),
        search: z.string().optional(),
        status: z.enum(["active", "inactive", "churned", "prospect"]).optional(),
        sortBy: z.enum(["name", "company", "createdAt", "icpScore"]).default("createdAt"),
        sortDir: z.enum(["asc", "desc"]).default("desc"),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, limit, search, status, sortBy, sortDir } = input;
      const offset = (page - 1) * limit;

      const conditions = [
        eq(customers.tenantId, ctx.tenantId),
        isNull(customers.deletedAt),
        ...(status ? [eq(customers.status, status)] : []),
        ...(search
          ? [
              or(
                ilike(customers.firstName, `%${search}%`),
                ilike(customers.lastName, `%${search}%`),
                ilike(customers.email, `%${search}%`),
                ilike(customers.company, `%${search}%`)
              )!,
            ]
          : []),
      ];

      const orderCol = {
        name: customers.firstName,
        company: customers.company,
        createdAt: customers.createdAt,
        icpScore: customers.icpScore,
      }[sortBy];

      const [data, [{ count }]] = await Promise.all([
        db
          .select()
          .from(customers)
          .where(and(...conditions))
          .orderBy(sortDir === "asc" ? asc(orderCol) : desc(orderCol))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)::int` })
          .from(customers)
          .where(and(...conditions)),
      ]);

      return {
        data,
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      };
    }),

  // ── Get by ID ─────────────────────────────────────────────────────────
  byId: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [customer] = await db
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.id, input.id),
            eq(customers.tenantId, ctx.tenantId),
            isNull(customers.deletedAt)
          )
        )
        .limit(1);

      if (!customer) throw new TRPCError({ code: "NOT_FOUND" });
      return customer;
    }),

  // ── Create ────────────────────────────────────────────────────────────
  create: tenantProcedure
    .input(createCustomerSchema)
    .mutation(async ({ ctx, input }) => {
      const [customer] = await db
        .insert(customers)
        .values({ ...input, tenantId: ctx.tenantId, ownerId: ctx.userId })
        .returning();

      await eventBus.emit("crm:customer-created", {
        tenantId: ctx.tenantId,
        customerId: customer!.id,
        email: customer!.email ?? undefined,
        company: customer!.company ?? undefined,
      });

      return customer!;
    }),

  // ── Update ────────────────────────────────────────────────────────────
  update: tenantProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: createCustomerSchema.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(customers)
        .set({ ...input.data, updatedAt: new Date() })
        .where(
          and(
            eq(customers.id, input.id),
            eq(customers.tenantId, ctx.tenantId),
            isNull(customers.deletedAt)
          )
        )
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });

      await eventBus.emit("crm:customer-updated", {
        tenantId: ctx.tenantId,
        customerId: input.id,
        changes: input.data as Record<string, unknown>,
      });

      return updated;
    }),

  // ── Soft delete ───────────────────────────────────────────────────────
  delete: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(customers)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(customers.id, input.id),
            eq(customers.tenantId, ctx.tenantId)
          )
        );

      await eventBus.emit("crm:customer-deleted", {
        tenantId: ctx.tenantId,
        customerId: input.id,
      });

      return { success: true };
    }),

  // ── Activity timeline ─────────────────────────────────────────────────
  activities: tenantProcedure
    .input(z.object({ customerId: z.string().uuid(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      return db
        .select()
        .from(activities)
        .where(
          and(
            eq(activities.customerId, input.customerId),
            eq(activities.tenantId, ctx.tenantId)
          )
        )
        .orderBy(desc(activities.occurredAt))
        .limit(input.limit);
    }),
});
