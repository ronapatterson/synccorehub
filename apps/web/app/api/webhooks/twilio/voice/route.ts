/**
 * Twilio Voice Webhook — Initial call handler.
 *
 * Twilio calls this URL when a call comes in to a virtual number.
 * We try to forward to the user's real phone first. The <Dial action>
 * fires when the dial completes/times out, redirecting to /dial-status.
 */
import { type NextRequest } from "next/server";
import {
  getVirtualNumberByPhone,
  getTenantTwilioCredentials,
  validateTwilioSignature,
  parseFormBody,
  twimlResponse,
  twimlError,
} from "../_twilio-validate";
import { decryptValue } from "../../../../../server/lib/crypto";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const params = parseFormBody(rawBody);

  const toNumber = params.To ?? "";
  const callSid = params.CallSid ?? "";
  const appBaseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  // Resolve the virtual number record
  const virtualNumber = await getVirtualNumberByPhone(toNumber);
  if (!virtualNumber) {
    return twimlError("Sorry, this number is not active.");
  }

  // Validate Twilio signature
  const creds = await getTenantTwilioCredentials(virtualNumber.tenantId);
  const signature = req.headers.get("x-twilio-signature") ?? "";
  const url = `${appBaseUrl}/api/webhooks/twilio/voice`;

  if (creds) {
    const valid = await validateTwilioSignature(creds.authToken, signature, url, params);
    if (!valid) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  // Decrypt the real forward-to number if set
  let forwardTo: string | null = null;
  if (virtualNumber.forwardToNumber) {
    try {
      forwardTo = decryptValue(virtualNumber.forwardToNumber);
    } catch {
      forwardTo = null;
    }
  }

  const dialStatusUrl = `${appBaseUrl}/api/webhooks/twilio/dial-status?vnId=${virtualNumber.id}&callSid=${encodeURIComponent(callSid)}&fromNumber=${encodeURIComponent(params.From ?? "")}`;

  if (forwardTo) {
    // Try to reach the user first; if no answer, dial-status will start the IVR
    return twimlResponse(`
  <Dial action="${dialStatusUrl}" timeout="20" method="POST">
    <Number>${forwardTo}</Number>
  </Dial>`);
  }

  // No forward number configured — go straight to IVR
  const gatherUrl = `${appBaseUrl}/api/webhooks/twilio/gather?step=name&vnId=${virtualNumber.id}&callSid=${encodeURIComponent(callSid)}&fromNumber=${encodeURIComponent(params.From ?? "")}`;
  const welcomeMsg = "Hi! The person you called is unavailable right now. Please say your name after the tone.";

  return twimlResponse(`
  <Gather input="speech dtmf" action="${gatherUrl}" method="POST" timeout="5" speechTimeout="2">
    <Say voice="Polly.Joanna">${welcomeMsg}</Say>
  </Gather>
  <Redirect method="POST">${gatherUrl}&amp;timeout=true</Redirect>`);
}
