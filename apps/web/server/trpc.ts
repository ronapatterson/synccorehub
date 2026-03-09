import "server-only";
import { initTRPC, TRPCError } from "@trpc/server";
import { type NextRequest } from "next/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { auth } from "@synccorehub/auth/server";
import { db } from "@synccorehub/database/client";
import { organization } from "@synccorehub/database/schema";
import { eq } from "drizzle-orm";

// ── Context ────────────────────────────────────────────────────────────────
export type TRPCContext = {
  req: NextRequest;
  userId: string | null;
  tenantId: string | null;
  organizationId: string | null;
  role: string | null;
};

export async function createTRPCContext(req: NextRequest): Promise<TRPCContext> {
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user) {
    return { req, userId: null, tenantId: null, organizationId: null, role: null };
  }

  const activeOrgId = (session.session as { activeOrganizationId?: string }).activeOrganizationId;

  let tenantId: string | null = null;
  let role: string | null = null;

  if (activeOrgId) {
    // Resolve tenantId from org
    const [org] = await db
      .select({ tenantId: organization.tenantId })
      .from(organization)
      .where(eq(organization.id, activeOrgId))
      .limit(1);

    tenantId = org?.tenantId?.toString() ?? null;

    // Get member role
    const { member } = await import("@synccorehub/database/schema");
    const [memberRecord] = await db
      .select({ role: member.role })
      .from(member)
      .where(eq(member.organizationId, activeOrgId))
      .limit(1);

    role = memberRecord?.role ?? null;
  }

  return {
    req,
    userId: session.user.id,
    tenantId,
    organizationId: activeOrgId ?? null,
    role,
  };
}

// ── tRPC init ──────────────────────────────────────────────────────────────
const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// ── Middleware ─────────────────────────────────────────────────────────────
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

const hasTenant = t.middleware(({ ctx, next }) => {
  if (!ctx.tenantId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No active organization. Please complete onboarding.",
    });
  }
  return next({ ctx: { ...ctx, tenantId: ctx.tenantId, userId: ctx.userId! } });
});

// ── Exports ────────────────────────────────────────────────────────────────
export const router = t.router;
export const publicProcedure = t.procedure;
export const authedProcedure = t.procedure.use(isAuthed);
export const tenantProcedure = t.procedure.use(isAuthed).use(hasTenant);
export const mergeRouters = t.mergeRouters;
