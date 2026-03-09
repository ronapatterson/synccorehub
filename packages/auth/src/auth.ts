/**
 * Business user auth — powers apps/web
 * Uses Better Auth with the organization plugin for multi-tenancy.
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import { twoFactor } from "better-auth/plugins";
import { db } from "@synccorehub/database/client";
import * as schema from "@synccorehub/database/schema";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

  // ── Session config ───────────────────────────────────────────────────
  session: {
    cookieName: "sch_session",
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24,       // Refresh if older than 1 day
  },

  // ── Email & password ─────────────────────────────────────────────────
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      // Handled by apps/web email action
      console.log(`[Auth] Password reset for ${user.email}: ${url}`);
    },
  },

  // ── Email verification ────────────────────────────────────────────────
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      console.log(`[Auth] Verify email for ${user.email}: ${url}`);
    },
  },

  // ── Social providers ─────────────────────────────────────────────────
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
  },

  // ── Plugins ───────────────────────────────────────────────────────────
  plugins: [
    // Organization plugin — maps to "tenant" in our domain
    organization({
      schema: {
        organization: schema.organization,
        member: schema.member,
        invitation: schema.invitation,
      },
      // Allowed roles within an organization
      allowedRoles: ["owner", "admin", "manager", "member", "viewer"],
      // Default role when invited
      defaultRole: "member",
      // Send invitation email
      sendInvitationEmail: async ({ invitation, inviter, organization: org, url }) => {
        console.log(
          `[Auth] Invitation from ${inviter.name} to ${invitation.email} for org ${org.name}: ${url}`
        );
      },
      // After org is created, create the tenant record
      organizationCreation: {
        afterCreate: async ({ organization: org, user }) => {
          // Link org to tenant — handled in apps/web onboarding flow
          console.log(`[Auth] Org created: ${org.name} by ${user.email}`);
        },
      },
    }),

    // TOTP 2FA
    twoFactor({
      schema: {
        twoFactor: schema.twoFactor,
      },
    }),
  ],

  // ── Secret ────────────────────────────────────────────────────────────
  secret: process.env.BETTER_AUTH_SECRET ?? "dev-secret-change-in-production",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
