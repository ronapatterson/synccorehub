import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { router, tenantProcedure } from "../trpc";
import { db } from "@synccorehub/database/client";
import { portalUsers, projectPortalAccess, referralCodes } from "@synccorehub/database/schema";
import { invitePortalUserSchema } from "@synccorehub/types";
import { nanoid } from "nanoid";

export const portalUsersRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    return db.select().from(portalUsers).where(and(eq(portalUsers.tenantId, ctx.tenantId), isNull(portalUsers.deletedAt)));
  }),

  invite: tenantProcedure
    .input(invitePortalUserSchema)
    .mutation(async ({ ctx, input }) => {
      const portalUserId = nanoid();
      const inviteToken = nanoid(48);

      const [portalUser] = await db.insert(portalUsers).values({
        id: portalUserId,
        tenantId: ctx.tenantId,
        email: input.email,
        name: input.name,
        customerId: input.customerId,
        magicLinkToken: inviteToken,
        magicLinkExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
      }).returning();

      // Grant project access
      if (input.projectIds.length > 0) {
        await db.insert(projectPortalAccess).values(
          input.projectIds.map((pid) => ({ projectId: pid, portalUserId }))
        ).onConflictDoNothing();
      }

      // Generate referral code
      const referralCode = nanoid(8).toUpperCase();
      await db.insert(referralCodes).values({
        tenantId: ctx.tenantId,
        portalUserId,
        customerId: input.customerId,
        code: referralCode,
      });

      // TODO: Send invitation email via @synccorehub/email
      const portalUrl = process.env.PORTAL_URL ?? "http://localhost:3001";
      console.log(`[PortalUsers] Invite link: ${portalUrl}/auth/accept-invite?token=${inviteToken}`);

      return { portalUser: portalUser!, inviteToken, referralCode };
    }),

  revokeAccess: tenantProcedure
    .input(z.object({ portalUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await db.update(portalUsers).set({ isActive: false, updatedAt: new Date() }).where(and(eq(portalUsers.id, input.portalUserId), eq(portalUsers.tenantId, ctx.tenantId)));
      return { success: true };
    }),
});
