import { NextResponse, type NextRequest } from "next/server";
import { getPortalSession } from "@synccorehub/auth/portal-server";

const PUBLIC_PATHS = ["/auth", "/api", "/_next", "/favicon.ico"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // Read portal session cookie
  const sessionToken = request.cookies.get("sch_portal_session")?.value;

  if (!sessionToken) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }

  const session = await getPortalSession(sessionToken);

  if (!session) {
    const response = NextResponse.redirect(new URL("/auth/login", request.url));
    response.cookies.delete("sch_portal_session");
    return response;
  }

  const response = NextResponse.next();
  response.headers.set("x-portal-user-id", session.user.id);
  response.headers.set("x-tenant-id", session.user.tenantId);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
