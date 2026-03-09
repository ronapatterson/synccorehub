import { NextRequest, NextResponse } from "next/server";
import { db } from "@synccorehub/database/client";
import { portalUsers } from "@synccorehub/database/schema";
import { and, eq, gt } from "drizzle-orm";
import { createPortalSession } from "@synccorehub/auth/portal-server";
import { hash } from "bcryptjs";
import { z } from "zod";

const bodySchema = z.object({ token: z.string(), password: z.string().min(8) });

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const [portalUser] = await db
    .select()
    .from(portalUsers)
    .where(
      and(
        eq(portalUsers.magicLinkToken, parsed.data.token),
        gt(portalUsers.magicLinkExpiresAt!, new Date())
      )
    )
    .limit(1);

  if (!portalUser) {
    return NextResponse.json({ error: "Invalid or expired invitation link" }, { status: 400 });
  }

  const hashedPassword = await hash(parsed.data.password, 12);

  await db.update(portalUsers).set({
    password: hashedPassword,
    emailVerified: true,
    magicLinkToken: null,
    magicLinkExpiresAt: null,
    updatedAt: new Date(),
  }).where(eq(portalUsers.id, portalUser.id));

  const { token } = await createPortalSession(portalUser.id, portalUser.tenantId);

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
