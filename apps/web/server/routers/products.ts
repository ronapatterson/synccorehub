import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { router, tenantProcedure } from "../trpc";
import { db } from "@synccorehub/database/client";
import { products } from "@synccorehub/database/schema";

export const productsRouter = router({
  list: tenantProcedure.query(async ({ ctx }) => {
    return db.select().from(products).where(and(eq(products.tenantId, ctx.tenantId), isNull(products.deletedAt)));
  }),

  create: tenantProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional(), type: z.enum(["service", "product", "subscription", "addon"]).default("service"), priceCents: z.number().min(0).default(0), currency: z.string().default("USD"), showInPortal: z.boolean().default(true), features: z.array(z.string()).default([]) }))
    .mutation(async ({ ctx, input }) => {
      const [product] = await db.insert(products).values({ ...input, tenantId: ctx.tenantId, createdById: ctx.userId }).returning();
      return product!;
    }),

  update: tenantProcedure
    .input(z.object({ id: z.string().uuid(), data: z.object({ name: z.string().optional(), status: z.enum(["draft", "active", "archived"]).optional(), showInPortal: z.boolean().optional(), priceCents: z.number().optional() }) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db.update(products).set({ ...input.data, updatedAt: new Date() }).where(and(eq(products.id, input.id), eq(products.tenantId, ctx.tenantId))).returning();
      return updated!;
    }),
});
