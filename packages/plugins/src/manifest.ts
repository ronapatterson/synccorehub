import { z } from "zod";

export const configSchemaFieldSchema = z.object({
  type: z.enum(["string", "number", "boolean", "url", "email"]),
  label: z.string(),
  description: z.string().optional(),
  required: z.boolean().default(false),
  secret: z.boolean().default(false),
  placeholder: z.string().optional(),
});

export const pluginRouteSchema = z.object({
  path: z.string(), // e.g. "/plugins/my-plugin"
  label: z.string(),
  icon: z.string().optional(),
});

export const pluginManifestSchema = z.object({
  id: z.string().min(1).regex(/^[a-z0-9-]+$/, "Plugin ID must be lowercase kebab-case"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Must be semver (e.g. 1.0.0)"),
  apiVersion: z.string().default("1.0"),
  hooks: z.array(z.string()).default([]),
  routes: z.array(pluginRouteSchema).default([]),
  configSchema: z.record(configSchemaFieldSchema).optional(),
});

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export type ConfigSchemaField = z.infer<typeof configSchemaFieldSchema>;

export function validateManifest(manifest: unknown): PluginManifest {
  return pluginManifestSchema.parse(manifest);
}
