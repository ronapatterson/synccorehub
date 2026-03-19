import { pluginRegistry } from "../registry";
import type { PluginManifest } from "../manifest";

export const CALL_ROUTING_PLUGIN_SLUG = "smart-call-routing";

const manifest: PluginManifest = {
  id: "smart-call-routing",
  version: "1.0.0",
  apiVersion: "1.0",
  hooks: ["call:missed", "call:scheduled"],
  routes: [
    {
      path: "/settings/call-routing",
      label: "Call Routing",
      icon: "PhoneForwarded",
    },
  ],
  configSchema: {
    // ── Twilio credentials ─────────────────────────────────────────────
    twilioAccountSid: {
      type: "string",
      label: "Twilio Account SID",
      description: "Found in your Twilio Console dashboard",
      required: true,
      secret: true,
      placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    },
    twilioAuthToken: {
      type: "string",
      label: "Twilio Auth Token",
      description: "Found in your Twilio Console dashboard",
      required: true,
      secret: true,
      placeholder: "your_auth_token",
    },
    twilioMessagingServiceSid: {
      type: "string",
      label: "Twilio Messaging Service SID",
      description: "SID of the Messaging Service for outbound SMS (optional)",
      required: false,
      secret: false,
      placeholder: "MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    },
    // ── Google Calendar OAuth app credentials ──────────────────────────
    googleClientId: {
      type: "string",
      label: "Google OAuth Client ID",
      description: "From Google Cloud Console → APIs & Services → Credentials",
      required: false,
      secret: false,
      placeholder: "xxxx.apps.googleusercontent.com",
    },
    googleClientSecret: {
      type: "string",
      label: "Google OAuth Client Secret",
      description: "Keep this secret — never share or commit it",
      required: false,
      secret: true,
      placeholder: "GOCSPX-xxxxxxxx",
    },
    // ── Microsoft Calendar OAuth app credentials ───────────────────────
    microsoftClientId: {
      type: "string",
      label: "Microsoft OAuth Client ID",
      description: "From Azure Portal → App registrations",
      required: false,
      secret: false,
    },
    microsoftClientSecret: {
      type: "string",
      label: "Microsoft OAuth Client Secret",
      required: false,
      secret: true,
    },
    microsoftTenantId: {
      type: "string",
      label: "Microsoft Tenant ID",
      description: 'Use "common" to support any Microsoft account',
      required: false,
      secret: false,
      placeholder: "common",
    },
    // ── Scheduling behavior ────────────────────────────────────────────
    schedulingPageBaseUrl: {
      type: "url",
      label: "App Base URL",
      description: "Public base URL of your app — used in SMS scheduling links",
      required: true,
      secret: false,
      placeholder: "https://app.example.com",
    },
    schedulingLinkTtlHours: {
      type: "number",
      label: "Scheduling Link Expiry (hours)",
      description: "How long the SMS scheduling link stays valid (default: 48)",
      required: false,
      secret: false,
      placeholder: "48",
    },
    ivrWelcomeMessage: {
      type: "string",
      label: "IVR Welcome Message",
      description: "Text played when the caller reaches the IVR (leave blank for default)",
      required: false,
      secret: false,
      placeholder: "Hi! The person you called is unavailable. Please say your name after the tone.",
    },
  },
};

export function registerCallRoutingPlugin() {
  pluginRegistry.register(manifest, {
    "call:missed": async ({ tenantId, callSid }) => {
      console.log(`[smart-call-routing] Missed call ${callSid} for tenant ${tenantId}`);
    },
    "call:scheduled": async ({ tenantId, appointmentId }) => {
      console.log(
        `[smart-call-routing] Appointment ${appointmentId} scheduled for tenant ${tenantId}`
      );
    },
  });
}
