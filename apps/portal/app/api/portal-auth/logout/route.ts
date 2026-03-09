import { NextRequest, NextResponse } from "next/server";
import { deletePortalSession } from "@synccorehub/auth/portal-server";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("sch_portal_session")?.value;
  if (token) await deletePortalSession(token);

  const response = NextResponse.json({ success: true });
  response.cookies.delete("sch_portal_session");
  return response;
}
