import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../trpc";
import { db } from "@synccorehub/database/client";
import { referrals, referralCodes, rewardAccounts, rewardTransactions } from "@synccorehub/database/schema";
import { eventBus } from "@synccorehub/plugins/hooks";

export const referralsRouter = router({
  listReferrals: tenantProcedure
    .input(z.object({ status: z.enum(["pending", "qualified", "rewarded", "rejected"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const conditions = [
        eq(referrals.tenantId, ctx.tenantId),
        ...(input?.status ? [eq(referrals.status, input.status)] : []),
      ];
      const rows = await db
        .select({ referral: referrals, referralCode: referralCodes })
        .from(referrals)
        .leftJoin(referralCodes, eq(referrals.referralCodeId, referralCodes.id))
        .where(and(...conditions))
        .orderBy(desc(referrals.createdAt))
        .limit(100);
      return rows.map(({ referral, referralCode }) => ({ ...referral, referralCode }));
    }),

  qualifyReferral: tenantProcedure
    .input(z.object({ referralId: z.string().uuid(), rewardPoints: z.number().int().min(0), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const [referral] = await db.select().from(referrals).where(and(eq(referrals.id, input.referralId), eq(referrals.tenantId, ctx.tenantId))).limit(1);
      if (!referral) throw new TRPCError({ code: "NOT_FOUND" });
      if (referral.status !== "pending") throw new TRPCError({ code: "BAD_REQUEST", message: "Referral is not pending" });

      await db.update(referrals).set({ status: "qualified", qualifiedAt: new Date(), qualificationNotes: input.notes, rewardPoints: input.rewardPoints, updatedAt: new Date() }).where(eq(referrals.id, input.referralId));

      // Credit points to referrer's reward account
      if (referral.referrerId && input.rewardPoints > 0) {
        let [account] = await db.select().from(rewardAccounts).where(eq(rewardAccounts.portalUserId, referral.referrerId)).limit(1);

        if (!account) {
          const [newAccount] = await db.insert(rewardAccounts).values({ tenantId: ctx.tenantId, portalUserId: referral.referrerId }).returning();
          account = newAccount!;
        }

        const newBalance = account.balance + input.rewardPoints;
        await db.update(rewardAccounts).set({ balance: newBalance, lifetimeEarned: account.lifetimeEarned + input.rewardPoints, updatedAt: new Date() }).where(eq(rewardAccounts.id, account.id));

        await db.insert(rewardTransactions).values({
          tenantId: ctx.tenantId,
          accountId: account.id,
          type: "credit",
          points: input.rewardPoints,
          balanceAfter: newBalance,
          description: `Referral reward for qualifying referral`,
          referralId: input.referralId,
        });

        await eventBus.emit("reward:earned", { tenantId: ctx.tenantId, portalUserId: referral.referrerId, points: input.rewardPoints, reason: "referral" });
      }

      await db.update(referrals).set({ status: "rewarded", rewardedAt: new Date() }).where(eq(referrals.id, input.referralId));

      await eventBus.emit("referral:qualified", { tenantId: ctx.tenantId, referralId: input.referralId, referrerId: referral.referrerId ?? "", points: input.rewardPoints });

      return { success: true };
    }),
});
