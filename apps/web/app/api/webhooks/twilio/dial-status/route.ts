/**
 * Twilio Dial Status Webhook
 *
 * Fired by Twilio after the <Dial> verb completes (from voice/route.ts).
 * If the user answered → do nothing.
 * If no-answer / busy / failed → start the IVR gather flow.
 */
import { type NextRequest } from "next/server";
import { parseFormBody, twimlResponse } from "../_twilio-validate";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const params = parseFormBody(rawBody);

  const dialStatus = params.DialCallStatus ?? "";
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  // Query params passed through from voice/route.ts
  const vnId = req.nextUrl.searchParams.get("vnId") ?? "";
  const callSid = req.nextUrl.searchParams.get("callSid") ?? params.CallSid ?? "";
  const fromNumber = req.nextUrl.searchParams.get("fromNumber") ?? params.From ?? "";

  // If the call was answered, nothing to do — hang up
  if (dialStatus === "completed") {
    return twimlResponse("<Hangup/>");
  }

  // Call was not answered — start the IVR to collect caller info
  const gatherUrl = `${appBaseUrl}/api/webhooks/twilio/gather?step=name&vnId=${encodeURIComponent(vnId)}&callSid=${encodeURIComponent(callSid)}&fromNumber=${encodeURIComponent(fromNumber)}`;

  return twimlResponse(`
  <Gather input="speech dtmf" action="${gatherUrl}" method="POST" timeout="5" speechTimeout="2">
    <Say voice="Polly.Joanna">Hi! The person you called is unavailable right now. Please say your name after the tone.</Say>
  </Gather>
  <Redirect method="POST">${gatherUrl}&amp;timeout=true</Redirect>`);
}
