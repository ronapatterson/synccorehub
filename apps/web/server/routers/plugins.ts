import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, tenantProcedure } from "../trpc";
import { db } from "@synccorehub/database/client";
import { plugins, installedPlugins, pluginConfigs } from "@synccorehub/database/schema";
import { eventBus } from "@synccorehub/plugins/hooks";
import { createCipheriv, randomBytes } from "crypto";

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY ?? "0".repeat(64), "hex");

function encryptValue(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}


export const pluginsRouter = router({
  // ── Marketplace: list available plugins ────────────────────────────────
  listAvailable: tenantProcedure
    .input(z.object({ category: z.string().optional() }))
    .query(async ({ input }) => {
      const conditions = input.category ? [eq(plugins.category, input.category)] : [];
      return db.select().from(plugins).where(conditions.length ? conditions[0] : undefined).orderBy(plugins.isFeatured);
    }),

  // ── Installed plugins for tenant ───────────────────────────────────────
  listInstalled: tenantProcedure.query(async ({ ctx }) => {
    return db
      .select({ installed: installedPlugins, plugin: plugins })
      .from(installedPlugins)
      .innerJoin(plugins, eq(installedPlugins.pluginId, plugins.id))
      .where(and(eq(installedPlugins.tenantId, ctx.tenantId)));
  }),

  // ── Install plugin ─────────────────────────────────────────────────────
  install: tenantProcedure
    .input(z.object({ pluginId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [plugin] = await db.select().from(plugins).where(eq(plugins.id, input.pluginId)).limit(1);
      if (!plugin) throw new TRPCError({ code: "NOT_FOUND" });

      const [installed] = await db
        .insert(installedPlugins)
        .values({ pluginId: input.pluginId, tenantId: ctx.tenantId, installedById: ctx.userId, lastEnabledAt: new Date() })
        .returning();

      await eventBus.emit("plugin:installed", { tenantId: ctx.tenantId, pluginSlug: plugin.slug });
      return installed!;
    }),

  // ── Enable / disable ───────────────────────────────────────────────────
  setStatus: tenantProcedure
    .input(z.object({ installedPluginId: z.string().uuid(), status: z.enum(["active", "disabled"]) }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(installedPlugins)
        .set({ status: input.status, ...(input.status === "active" ? { lastEnabledAt: new Date() } : {}) })
        .where(and(eq(installedPlugins.id, input.installedPluginId), eq(installedPlugins.tenantId, ctx.tenantId)))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND" });
      return updated;
    }),

  // ── Save config ────────────────────────────────────────────────────────
  saveConfig: tenantProcedure
    .input(
      z.object({
        installedPluginId: z.string().uuid(),
        entries: z.array(z.object({ key: z.string(), value: z.string(), isSecret: z.boolean().default(false) })),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.delete(pluginConfigs).where(eq(pluginConfigs.installedPluginId, input.installedPluginId));

      if (input.entries.length > 0) {
        await db.insert(pluginConfigs).values(
          input.entries.map((e) => ({
            installedPluginId: input.installedPluginId,
            tenantId: ctx.tenantId,
            key: e.key,
            encryptedValue: e.isSecret ? encryptValue(e.value) : null,
            plaintextValue: !e.isSecret ? e.value : null,
            isSecret: e.isSecret,
          }))
        );
      }

      return { success: true };
    }),

  // ── Read config (decrypt secrets) ─────────────────────────────────────
  getConfig: tenantProcedure
    .input(z.object({ installedPluginId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(pluginConfigs)
        .where(and(eq(pluginConfigs.installedPluginId, input.installedPluginId), eq(pluginConfigs.tenantId, ctx.tenantId)));

      return rows.map((r) => ({
        key: r.key,
        value: r.isSecret && r.encryptedValue ? "••••••••" : r.plaintextValue ?? "",
        isSecret: r.isSecret,
      }));
    }),
});
