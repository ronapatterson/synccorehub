/**
 * Twilio Status Callback Webhook
 *
 * Twilio fires this for every call status change (initiated, ringing,
 * in-progress, completed, no-answer, busy, failed).
 * We use it to emit the call:missed hook for calls that completed without
 * going through our IVR (e.g. caller hung up before IVR ran).
 */
import { type NextRequest } from "next/server";
import { db } from "@synccorehub/database/client";
import { missedCallLogs } from "@synccorehub/database/schema";
import { eq } from "drizzle-orm";
import { eventBus } from "@synccorehub/plugins/hooks";
import { getVirtualNumberByPhone, parseFormBody } from "../_twilio-validate";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const params = parseFormBody(rawBody);

  const callStatus = params.CallStatus ?? "";
  const callSid = params.CallSid ?? "";
  const toNumber = params.To ?? "";
  const fromNumber = params.From ?? "";

  // Only act on terminal non-answer statuses
  if (!["no-answer", "busy", "failed"].includes(callStatus)) {
    return new Response("OK", { status: 200 });
  }

  const virtualNumber = await getVirtualNumberByPhone(toNumber);
  if (!virtualNumber) {
    return new Response("OK", { status: 200 });
  }

  // Check if we already have a missed call log for this callSid (created by IVR gather)
  const [existing] = await db
    .select({ id: missedCallLogs.id, status: missedCallLogs.status })
    .from(missedCallLogs)
    .where(eq(missedCallLogs.callSid, callSid))
    .limit(1);

  // If IVR already handled it, the log exists — just emit the event
  if (existing) {
    await eventBus.emit("call:missed", {
      tenantId: virtualNumber.tenantId,
      callSid,
      fromNumber,
      virtualNumberId: virtualNumber.id,
      timestamp: new Date().toISOString(),
    });
    return new Response("OK", { status: 200 });
  }

  // Caller hung up before IVR ran — create a minimal missed call log
  try {
    await db.insert(missedCallLogs).values({
      tenantId: virtualNumber.tenantId,
      virtualNumberId: virtualNumber.id,
      callSid,
      fromNumber,
      status: "no_action",
      twilioPayload: params as Record<string, unknown>,
    });

    await eventBus.emit("call:missed", {
      tenantId: virtualNumber.tenantId,
      callSid,
      fromNumber,
      virtualNumberId: virtualNumber.id,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    // Duplicate callSid — already handled elsewhere; ignore
    console.error("[status-callback] Error:", err);
  }

  return new Response("OK", { status: 200 });
}
