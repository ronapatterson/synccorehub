import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../trpc";
import { db } from "@synccorehub/database/client";
import { icpProfiles, icpCriteria } from "@synccorehub/database/schema";
import { icpCriterionSchema } from "@synccorehub/types";

export const icpRouter = router({
  // ── List profiles ──────────────────────────────────────────────────────
  listProfiles: tenantProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(icpProfiles)
      .where(and(eq(icpProfiles.tenantId, ctx.tenantId), isNull(icpProfiles.deletedAt)));
  }),

  // ── Get profile with criteria ──────────────────────────────────────────
  profileWithCriteria: tenantProcedure
    .input(z.object({ profileId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [profile] = await db
        .select()
        .from(icpProfiles)
        .where(
          and(
            eq(icpProfiles.id, input.profileId),
            eq(icpProfiles.tenantId, ctx.tenantId),
            isNull(icpProfiles.deletedAt)
          )
        )
        .limit(1);

      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });

      const criteria = await db
        .select()
        .from(icpCriteria)
        .where(and(eq(icpCriteria.profileId, input.profileId), eq(icpCriteria.tenantId, ctx.tenantId)));

      return { ...profile, criteria };
    }),

  // ── Create profile ────────────────────────────────────────────────────
  createProfile: tenantProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        matchThreshold: z.number().min(0).max(100).default(70),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const [profile] = await db
        .insert(icpProfiles)
        .values({ ...input, tenantId: ctx.tenantId, createdById: ctx.userId })
        .returning();

      return profile!;
    }),

  // ── Upsert criteria ────────────────────────────────────────────────────
  // Replace all criteria for a profile in one call
  saveCriteria: tenantProcedure
    .input(
      z.object({
        profileId: z.string().uuid(),
        criteria: z.array(icpCriterionSchema),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify profile belongs to tenant
      const [profile] = await db
        .select({ id: icpProfiles.id })
        .from(icpProfiles)
        .where(
          and(
            eq(icpProfiles.id, input.profileId),
            eq(icpProfiles.tenantId, ctx.tenantId)
          )
        )
        .limit(1);

      if (!profile) throw new TRPCError({ code: "NOT_FOUND" });

      // Delete old + insert new (simple replace strategy)
      await db.delete(icpCriteria).where(eq(icpCriteria.profileId, input.profileId));

      if (input.criteria.length > 0) {
        await db.insert(icpCriteria).values(
          input.criteria.map((c) => ({
            ...c,
            profileId: input.profileId,
            tenantId: ctx.tenantId,
          }))
        );
      }

      // TODO: Enqueue BullMQ job to rescore all customers against this profile
      // await icpScoringQueue.add("rescore", { tenantId: ctx.tenantId, profileId: input.profileId });

      return { success: true };
    }),

  // ── Delete profile ────────────────────────────────────────────────────
  deleteProfile: tenantProcedure
    .input(z.object({ profileId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(icpProfiles)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(icpProfiles.id, input.profileId),
            eq(icpProfiles.tenantId, ctx.tenantId)
          )
        );

      return { success: true };
    }),
});
