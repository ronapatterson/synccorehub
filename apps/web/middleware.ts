import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@synccorehub/auth/server";

// Routes that don't require authentication
const PUBLIC_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/verify-email",
  "/api/auth",
  "/api/trpc",
  "/_next",
  "/favicon.ico",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check auth session
  const session = await auth.api.getSession({ headers: request.headers });

  if (!session?.user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Attach tenant context from session's active organization
  const response = NextResponse.next();

  // Better Auth organization plugin sets activeOrganizationId on session
  const activeOrgId = (session.session as { activeOrganizationId?: string }).activeOrganizationId;

  if (activeOrgId) {
    response.headers.set("x-organization-id", activeOrgId);
    response.headers.set("x-user-id", session.user.id);
  } else if (!pathname.startsWith("/onboarding") && pathname !== "/") {
    // No active org — redirect to onboarding
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
