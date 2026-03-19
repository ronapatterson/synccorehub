import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { router, tenantProcedure } from "../trpc";
import { db } from "@synccorehub/database/client";
import {
  tenants,
  subscriptions,
  plans,
  organization,
  member,
  invitation,
  user,
} from "@synccorehub/database/schema";
import { sendEmail, TeamInvitationEmail } from "@synccorehub/email";
import * as React from "react";

export const tenantsRouter = router({
  current: tenantProcedure.query(async ({ ctx }) => {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, ctx.tenantId)).limit(1);
    if (!tenant) throw new TRPCError({ code: "NOT_FOUND" });
    return tenant;
  }),

  subscription: tenantProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select({ subscription: subscriptions, plan: plans })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.tenantId, ctx.tenantId))
      .limit(1);

    return rows[0] ?? null;
  }),

  update: tenantProcedure
    .input(
      z.object({
        name: z.string().optional(),
        logoUrl: z.string().url().optional(),
        primaryColor: z.string().optional(),
        portalDomain: z.string().optional(),
        industry: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(tenants)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(tenants.id, ctx.tenantId))
        .returning();
      return updated!;
    }),

  // ── Team management ──────────────────────────────────────────────────────

  listMembers: tenantProcedure.query(async ({ ctx }) => {
    // Find org linked to this tenant
    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.tenantId, ctx.tenantId))
      .limit(1);
    if (!org) return [];

    const members = await db
      .select({ id: member.id, role: member.role, userId: member.userId, createdAt: member.createdAt })
      .from(member)
      .where(eq(member.organizationId, org.id));

    // Build a map for all users (simple full fetch — small table at org scale)
    const allUsers = await db
      .select({ id: user.id, name: user.name, email: user.email, image: user.image })
      .from(user);
    const userMap = new Map(allUsers.map((u) => [u.id, u]));

    return members.map((m) => ({ ...m, user: userMap.get(m.userId) ?? null }));
  }),

  listInvitations: tenantProcedure.query(async ({ ctx }) => {
    const [org] = await db
      .select()
      .from(organization)
      .where(eq(organization.tenantId, ctx.tenantId))
      .limit(1);
    if (!org) return [];

    return db
      .select()
      .from(invitation)
      .where(and(eq(invitation.organizationId, org.id), eq(invitation.status, "pending")));
  }),

  inviteMember: tenantProcedure
    .input(z.object({ email: z.string().email(), role: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [org] = await db
        .select()
        .from(organization)
        .where(eq(organization.tenantId, ctx.tenantId))
        .limit(1);
      if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });

      // Check if already a member
      const [existingUser] = await db
        .select()
        .from(user)
        .where(eq(user.email, input.email))
        .limit(1);

      if (existingUser) {
        const [existingMember] = await db
          .select()
          .from(member)
          .where(
            and(eq(member.userId, existingUser.id), eq(member.organizationId, org.id)),
          )
          .limit(1);
        if (existingMember) {
          throw new TRPCError({ code: "CONFLICT", message: "User is already a member." });
        }
      }

      const [inv] = await db
        .insert(invitation)
        .values({
          id: nanoid(),
          email: input.email,
          inviterId: ctx.userId,
          organizationId: org.id,
          role: input.role,
          status: "pending",
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
        .returning();

      // Send invitation email (best-effort)
      try {
        const [inviter] = await db.select().from(user).where(eq(user.id, ctx.userId)).limit(1);
        await sendEmail({
          to: input.email,
          subject: `You've been invited to join ${org.name}`,
          react: React.createElement(TeamInvitationEmail, {
            inviterName: inviter?.name ?? "A team member",
            orgName: org.name,
            role: input.role,
            inviteUrl: `${process.env.APP_URL}/accept-invitation?token=${inv!.id}`,
          }),
        });
      } catch {
        // Non-fatal — invitation still created
      }

      return inv;
    }),

  removeMember: tenantProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [org] = await db
        .select()
        .from(organization)
        .where(eq(organization.tenantId, ctx.tenantId))
        .limit(1);
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      // Verify member belongs to this org
      const [m] = await db
        .select()
        .from(member)
        .where(and(eq(member.id, input.memberId), eq(member.organizationId, org.id)))
        .limit(1);
      if (!m) throw new TRPCError({ code: "NOT_FOUND" });
      if (m.role === "owner") throw new TRPCError({ code: "FORBIDDEN", message: "Cannot remove owner" });

      await db.delete(member).where(eq(member.id, input.memberId));
    }),

  cancelInvitation: tenantProcedure
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [org] = await db
        .select()
        .from(organization)
        .where(eq(organization.tenantId, ctx.tenantId))
        .limit(1);
      if (!org) throw new TRPCError({ code: "NOT_FOUND" });

      const [inv] = await db
        .select()
        .from(invitation)
        .where(
          and(eq(invitation.id, input.invitationId), eq(invitation.organizationId, org.id)),
        )
        .limit(1);
      if (!inv) throw new TRPCError({ code: "NOT_FOUND" });

      await db
        .update(invitation)
        .set({ status: "canceled" })
        .where(eq(invitation.id, input.invitationId));
    }),
});
