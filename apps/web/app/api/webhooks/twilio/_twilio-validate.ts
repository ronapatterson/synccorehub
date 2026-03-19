/**
 * Shared Twilio webhook validation utilities.
 * These are used across all Twilio webhook routes to verify request authenticity.
 */
import { db } from "@synccorehub/database/client";
import { callRoutingNumbers, pluginConfigs, installedPlugins, plugins } from "@synccorehub/database/schema";
import { and, eq } from "drizzle-orm";
import { decryptValue } from "../../../../server/lib/crypto";

/**
 * Validate a Twilio webhook request signature.
 * Twilio signs each request with HMAC-SHA256 using the account auth token.
 */
export async function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): Promise<boolean> {
  const twilio = (await import("twilio")).default;
  return twilio.validateRequest(authToken, signature, url, params);
}

/**
 * Look up a virtual number by its Twilio phone number (To field).
 * Returns null if not found or released.
 */
export async function getVirtualNumberByPhone(phoneNumber: string) {
  const [number] = await db
    .select()
    .from(callRoutingNumbers)
    .where(
      and(
        eq(callRoutingNumbers.phoneNumber, phoneNumber),
        eq(callRoutingNumbers.status, "active")
      )
    )
    .limit(1);

  return number ?? null;
}

/**
 * Fetch and decrypt the Twilio auth token for a tenant's plugin config.
 */
export async function getTenantTwilioCredentials(tenantId: string): Promise<{
  accountSid: string;
  authToken: string;
  messagingServiceSid?: string;
} | null> {
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
    .where(
      and(
        eq(pluginConfigs.tenantId, tenantId),
        eq(plugins.slug, "smart-call-routing")
      )
    );

  const config: Record<string, string> = {};
  for (const row of rows) {
    config[row.key] = row.isSecret && row.encryptedValue
      ? decryptValue(row.encryptedValue)
      : row.plaintextValue ?? "";
  }

  if (!config.twilioAccountSid || !config.twilioAuthToken) return null;

  return {
    accountSid: config.twilioAccountSid,
    authToken: config.twilioAuthToken,
    messagingServiceSid: config.twilioMessagingServiceSid || undefined,
  };
}

/**
 * Parse application/x-www-form-urlencoded body from a Twilio webhook.
 */
export function parseFormBody(body: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(body));
}

/**
 * Build a TwiML XML response string.
 */
export function twimlResponse(xml: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<Response>${xml}</Response>`, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}

export function twimlError(message: string): Response {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Say>${message}</Say><Hangup/></Response>`,
    { status: 200, headers: { "Content-Type": "text/xml" } }
  );
}
