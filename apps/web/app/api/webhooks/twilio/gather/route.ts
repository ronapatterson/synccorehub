/**
 * Twilio IVR Gather Webhook — Multi-step state machine.
 *
 * step=name     → collect caller's name (speech or DTMF)
 * step=callback → collect callback phone number (DTMF)
 * step=finalize → save to DB, enqueue SMS job, say goodbye
 */
import { type NextRequest } from "next/server";
import Redis from "ioredis";
import { type ConnectionOptions } from "bullmq";
import { db } from "@synccorehub/database/client";
import { missedCallLogs, callRoutingNumbers } from "@synccorehub/database/schema";
import { eq } from "drizzle-orm";
import { parseFormBody, twimlResponse } from "../_twilio-validate";

const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// BullMQ queue — dynamic import to avoid circular deps
async function enqueueSchedulingSms(data: {
  tenantId: string;
  missedCallLogId: string;
  virtualNumberId: string;
  callerPhone: string;
  callerName: string | null;
}) {
  const { Queue } = await import("bullmq");
  const queue = new Queue("call-routing-sms", {
    connection: redis as unknown as ConnectionOptions,
  });
  await queue.add("send-scheduling-sms", data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5_000 },
  });
  await queue.close();
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const params = parseFormBody(rawBody);

  const url = req.nextUrl;
  const step = url.searchParams.get("step") ?? "name";
  const vnId = url.searchParams.get("vnId") ?? "";
  const callSid = url.searchParams.get("callSid") ?? params.CallSid ?? "";
  const fromNumber = url.searchParams.get("fromNumber") ?? params.From ?? "";
  const isTimeout = url.searchParams.get("timeout") === "true";
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  const redisKeyName = `ivr:${callSid}:name`;
  const redisKeyCallback = `ivr:${callSid}:callback`;
  const TTL = 300; // 5 minutes

  if (step === "name") {
    // Store name if provided
    const speechResult = params.SpeechResult ?? params.Digits ?? "";
    if (speechResult && !isTimeout) {
      await redis.setex(redisKeyName, TTL, speechResult.trim());
    }

    // Move to callback step
    const callbackUrl = `${appBaseUrl}/api/webhooks/twilio/gather?step=callback&vnId=${encodeURIComponent(vnId)}&callSid=${encodeURIComponent(callSid)}&fromNumber=${encodeURIComponent(fromNumber)}`;

    return twimlResponse(`
  <Gather input="dtmf" action="${callbackUrl}" method="POST" timeout="8" numDigits="10" finishOnKey="#">
    <Say voice="Polly.Joanna">Thanks! Now please enter your best callback number, then press pound.</Say>
  </Gather>
  <Redirect method="POST">${callbackUrl}&amp;timeout=true</Redirect>`);
  }

  if (step === "callback") {
    // Store callback number if provided via DTMF
    const digits = params.Digits ?? "";
    if (digits && !isTimeout) {
      const cleaned = digits.replace(/\D/g, "");
      const e164 = cleaned.length === 10 ? `+1${cleaned}` : cleaned.length === 11 && cleaned.startsWith("1") ? `+${cleaned}` : fromNumber;
      await redis.setex(redisKeyCallback, TTL, e164);
    } else if (isTimeout || !digits) {
      // Use the original caller number as fallback
      await redis.setex(redisKeyCallback, TTL, fromNumber);
    }

    // Finalize
    const finalizeUrl = `${appBaseUrl}/api/webhooks/twilio/gather?step=finalize&vnId=${encodeURIComponent(vnId)}&callSid=${encodeURIComponent(callSid)}&fromNumber=${encodeURIComponent(fromNumber)}`;
    return twimlResponse(`<Redirect method="POST">${finalizeUrl}</Redirect>`);
  }

  if (step === "finalize") {
    // Read from Redis
    const callerName = await redis.get(redisKeyName);
    const callerCallbackNumber = (await redis.get(redisKeyCallback)) ?? fromNumber;

    // Lookup virtual number record
    const [virtualNumber] = await db
      .select()
      .from(callRoutingNumbers)
      .where(eq(callRoutingNumbers.id, vnId))
      .limit(1);

    if (!virtualNumber) {
      return twimlResponse(`
  <Say voice="Polly.Joanna">We encountered an error. Please call back later. Goodbye!</Say>
  <Hangup/>`);
    }

    try {
      // Create the missed call log
      const [log] = await db
        .insert(missedCallLogs)
        .values({
          tenantId: virtualNumber.tenantId,
          virtualNumberId: virtualNumber.id,
          callSid,
          fromNumber,
          callerName: callerName ?? null,
          callerCallbackNumber,
          status: "missed",
          twilioPayload: {},
        })
        .returning();

      if (log) {
        // Enqueue the SMS + scheduling session creation job
        await enqueueSchedulingSms({
          tenantId: virtualNumber.tenantId,
          missedCallLogId: log.id,
          virtualNumberId: virtualNumber.id,
          callerPhone: callerCallbackNumber,
          callerName: callerName ?? null,
        });
      }
    } catch (err) {
      console.error("[IVR] Failed to save missed call log:", err);
    }

    // Clean up Redis keys
    await redis.del(redisKeyName, redisKeyCallback);

    return twimlResponse(`
  <Say voice="Polly.Joanna">Perfect! We'll send you a text message with a link to schedule a callback. Goodbye!</Say>
  <Hangup/>`);
  }

  return twimlResponse("<Hangup/>");
}
