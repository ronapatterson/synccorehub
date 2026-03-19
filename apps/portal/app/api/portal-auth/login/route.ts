import { NextRequest, NextResponse } from "next/server";
import { db } from "@synccorehub/database/client";
import { portalUsers } from "@synccorehub/database/schema";
import { and, eq, isNull } from "drizzle-orm";
import { createPortalSession } from "@synccorehub/auth/portal-server";
import { compare } from "bcryptjs";
import { z } from "zod";

const bodySchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  // TODO: resolve tenantId from custom domain or subdomain (request.headers.get("host"))
  // For now, look up by email across all tenants (demo mode)
  const [portalUser] = await db
    .select()
    .from(portalUsers)
    .where(and(eq(portalUsers.email, parsed.data.email), eq(portalUsers.isActive, true), isNull(portalUsers.deletedAt)))
    .limit(1);

  if (!portalUser) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // Verify password
  const passwordValid = portalUser.password
    ? await compare(parsed.data.password, portalUser.password)
    : false;

  if (!passwordValid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // Create session
  const { token } = await createPortalSession(portalUser.id, portalUser.tenantId);

  // Update last login
  await db.update(portalUsers).set({ lastLoginAt: new Date() }).where(eq(portalUsers.id, portalUser.id));

  const response = NextResponse.json({ success: true });
  response.cookies.set("sch_portal_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  return response;
}
