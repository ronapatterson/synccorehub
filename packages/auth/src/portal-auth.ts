/**
 * Portal user auth — powers apps/portal
 * Separate Better Auth instance using the portal_users / portal_sessions tables.
 * Portal users are scoped to a specific tenant and customer.
 */
import { betterAuth } from "better-auth";
import { db } from "@synccorehub/database/client";
import type { portalUsers, portalSessions } from "@synccorehub/database/schema";
import { eq, and } from "drizzle-orm";

// ── Custom Drizzle adapter for portal tables ───────────────────────────────
// We hand-wire this because portal users live in different tables from business users
export const portalAuth = betterAuth({
  database: {
    // Minimal adapter — portal auth uses custom logic via server actions
    // The session management is handled directly via portalSessions table
    provider: "postgresql",
    url: process.env.DATABASE_URL ?? "",
  },

  session: {
    cookieName: "sch_portal_session",
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,
  },

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Portals send magic link invites
  },

  secret: process.env.PORTAL_AUTH_SECRET ?? "dev-portal-secret-change-in-production",
  baseURL: process.env.PORTAL_AUTH_URL ?? "http://localhost:3001",
});

// ── Manual session helpers for portal ─────────────────────────────────────
// These are used by the portal app's server actions / middleware

export async function getPortalSession(token: string) {
  const { portalSessions: sessions, portalUsers: users } = await import(
    "@synccorehub/database/schema"
  );

  const row = await db
    .select()
    .from(sessions)
    .innerJoin(users, eq(sessions.portalUserId, users.id))
    .where(
      and(eq(sessions.token, token), eq(users.isActive, true))
    )
    .limit(1);

  const record = row[0];
  if (!record) return null;

  const session = record.portal_sessions;
  const user = record.portal_users;

  if (new Date(session.expiresAt) < new Date()) return null;

  return { session, user };
}

export async function createPortalSession(portalUserId: string, tenantId: string) {
  const { portalSessions } = await import("@synccorehub/database/schema");
  const { nanoid } = await import("nanoid");

  const token = nanoid(64);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days

  const [session] = await db
    .insert(portalSessions)
    .values({
      id: nanoid(),
      portalUserId,
      tenantId,
      token,
      expiresAt,
    })
    .returning();

  return { session: session!, token };
}

export async function deletePortalSession(token: string) {
  const { portalSessions } = await import("@synccorehub/database/schema");

  await db.delete(portalSessions).where(eq(portalSessions.token, token));
}
