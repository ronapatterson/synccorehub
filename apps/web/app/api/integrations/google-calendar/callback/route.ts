/**
 * Google Calendar OAuth — callback handler.
 * Exchanges the authorization code for tokens and stores them on the number.
 */
import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@synccorehub/auth/server";
import { db } from "@synccorehub/database/client";
import {
  callRoutingNumbers,
  pluginConfigs,
  installedPlugins,
  plugins,
} from "@synccorehub/database/schema";
import { and, eq } from "drizzle-orm";
import { decryptValue, encryptValue } from "../../../../../server/lib/crypto";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const stateParam = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL("/settings/call-routing?error=google_denied", req.url)
    );
  }

  if (!code || !stateParam) {
    return new Response("Missing code or state", { status: 400 });
  }

  let numberId: string;
  let tenantId: string;
  try {
    const decoded = JSON.parse(Buffer.from(stateParam, "base64").toString("utf8"));
    numberId = decoded.numberId;
    tenantId = decoded.tenantId;
  } catch {
    return new Response("Invalid state parameter", { status: 400 });
  }

  // Fetch plugin config for credentials
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
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google-calendar/callback`;

  if (!clientId || !clientSecret) {
    return new Response("Google OAuth credentials not configured.", { status: 400 });
  }

  const { google } = await import("googleapis");
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  let tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null };
  try {
    const result = await oauth2Client.getToken(code);
    tokens = result.tokens ?? {};
  } catch {
    return NextResponse.redirect(
      new URL("/settings/call-routing?error=google_token_exchange", req.url)
    );
  }

  if (!tokens.access_token) {
    return NextResponse.redirect(
      new URL("/settings/call-routing?error=google_no_token", req.url)
    );
  }

  await db
    .update(callRoutingNumbers)
    .set({
      googleCalendarAccessToken: encryptValue(tokens.access_token),
      googleCalendarRefreshToken: tokens.refresh_token
        ? encryptValue(tokens.refresh_token)
        : undefined,
      googleCalendarTokenExpiresAt: tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : undefined,
      googleCalendarConnected: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(callRoutingNumbers.id, numberId),
        eq(callRoutingNumbers.tenantId, tenantId)
      )
    );

  return NextResponse.redirect(
    new URL("/settings/call-routing?connected=google", req.url)
  );
}
