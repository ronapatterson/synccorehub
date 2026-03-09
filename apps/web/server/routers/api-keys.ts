import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { router, tenantProcedure } from "../trpc";
import { db } from "@synccorehub/database/client";
import { apiKeys } from "@synccorehub/database/schema";
import { createHmac, randomBytes } from "crypto";
import { nanoid } from "nanoid";

const AVAILABLE_SCOPES = [
  "customers:read", "customers:write",
  "leads:read", "leads:write",
  "projects:read",
  "analytics:read",
  "webhooks:manage",
];

export const apiKeysRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    return db.select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      status: apiKeys.status,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    }).from(apiKeys).where(and(eq(apiKeys.tenantId, ctx.tenantId), eq(apiKeys.status, "active")));
  }),

  create: tenantProcedure
    .input(z.object({ name: z.string().min(1), scopes: z.array(z.string()), expiresAt: z.string().datetime().optional() }))
    .mutation(async ({ ctx, input }) => {
      const rawKey = `sk_live_${randomBytes(32).toString("base64url")}`;
      const keyPrefix = rawKey.substring(0, 20) + "...";
      const keyHash = createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "dev-secret").update(rawKey).digest("hex");

      const [key] = await db.insert(apiKeys).values({
        tenantId: ctx.tenantId,
        name: input.name,
        keyPrefix,
        keyHash,
        scopes: input.scopes,
        createdById: ctx.userId,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      }).returning();

      // Return full key once — never shown again
      return { ...key!, fullKey: rawKey };
    }),

  revoke: tenantProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await db.update(apiKeys).set({ status: "revoked", revokedAt: new Date(), revokedById: ctx.userId }).where(and(eq(apiKeys.id, input.id), eq(apiKeys.tenantId, ctx.tenantId)));
      return { success: true };
    }),

  availableScopes: tenantProcedure.query(() => AVAILABLE_SCOPES),
});
