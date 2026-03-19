/**
 * Google Calendar OAuth — initiate the authorization flow.
 * Requires: ?numberId=<uuid>
 * The user must be authenticated (CRM session).
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

  // Read tenant's Google OAuth credentials from plugin config
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

  const clientId = config.googleClientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = config.googleClientSecret || process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return new Response("Google OAuth credentials not configured.", { status: 400 });
  }

  const { google } = await import("googleapis");
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar/callback`;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  const state = Buffer.from(
    JSON.stringify({ numberId, tenantId })
  ).toString("base64");

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
    state,
  });

  return NextResponse.redirect(authUrl);
}
