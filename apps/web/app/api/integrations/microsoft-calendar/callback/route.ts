/**
 * Microsoft Calendar OAuth — callback handler.
 * Exchanges the authorization code for tokens and stores them.
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
      new URL("/settings/call-routing?error=microsoft_denied", req.url)
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
  const clientSecret = config.microsoftClientSecret || process.env.MICROSOFT_CLIENT_SECRET;
  const msftTenantId = config.microsoftTenantId || process.env.MICROSOFT_TENANT_ID || "common";
  const redirectUri =
    process.env.MICROSOFT_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/microsoft-calendar/callback`;

  if (!clientId || !clientSecret) {
    return new Response("Microsoft OAuth credentials not configured.", { status: 400 });
  }

  // Exchange code for tokens via Microsoft identity platform
  const tokenRes = await fetch(
    `https://login.microsoftonline.com/${msftTenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        scope: "Calendars.Read offline_access",
      }),
    }
  );

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL("/settings/call-routing?error=microsoft_token_exchange", req.url)
    );
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000)
    : null;

  await db
    .update(callRoutingNumbers)
    .set({
      microsoftCalendarAccessToken: encryptValue(tokenData.access_token),
      microsoftCalendarRefreshToken: tokenData.refresh_token
        ? encryptValue(tokenData.refresh_token)
        : undefined,
      microsoftCalendarTokenExpiresAt: expiresAt ?? undefined,
      microsoftCalendarConnected: true,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(callRoutingNumbers.id, numberId),
        eq(callRoutingNumbers.tenantId, tenantId)
      )
    );

  return NextResponse.redirect(
    new URL("/settings/call-routing?connected=microsoft", req.url)
  );
}
