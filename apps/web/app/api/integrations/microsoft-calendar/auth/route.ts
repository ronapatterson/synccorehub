/**
 * Microsoft Calendar OAuth — initiate authorization flow.
 * Requires: ?numberId=<uuid>
 */
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@synccorehub/auth/server";
import { db } from "@synccorehub/database/client";
import { pluginConfigs, installedPlugins, plugins } from "@synccorehub/database/schema";
import { and, eq } from "drizzle-orm";
import { decryptValue } from "../../../../../server/lib/crypto";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const numberId = req.nextUrl.searchParams.get("numberId");
  if (!numberId) {
    return new Response("Missing numberId", { status: 400 });
  }

  const tenantId = req.headers.get("x-tenant-id") ?? "";
  const rows = await db
    .select({
      key: pluginConfigs.key,
      encryptedValue: pluginConfigs.encryptedValue,
      plaintextValue: pluginConfigs.plaintextValue,
      isSecret: pluginConfigs.isSecret,
    })
    .from(pluginConfigs)
    .innerJoin(installedPlugins, eq(pluginConfigs.installedPluginId, installedPlugins.id))
    .innerJoin(plugins, eq(installedPlugins.pluginId, plugins.id))
    .where(and(eq(pluginConfigs.tenantId, tenantId), eq(plugins.slug, "smart-call-routing")));

  const config: Record<string, string> = {};
  for (const row of rows) {
    config[row.key] = row.isSecret && row.encryptedValue
      ? decryptValue(row.encryptedValue)
      : row.plaintextValue ?? "";
  }

  const clientId = config.microsoftClientId || process.env.MICROSOFT_CLIENT_ID;
  const msftTenantId = config.microsoftTenantId || process.env.MICROSOFT_TENANT_ID || "common";
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/microsoft-calendar/callback`;

  if (!clientId) {
    return new Response("Microsoft OAuth credentials not configured.", { status: 400 });
  }

  const state = Buffer.from(
    JSON.stringify({ numberId, tenantId })
  ).toString("base64");

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    response_mode: "query",
    scope: "Calendars.Read offline_access",
    state,
  });

  const authUrl = `https://login.microsoftonline.com/${msftTenantId}/oauth2/v2.0/authorize?${params}`;
  return NextResponse.redirect(authUrl);
}
