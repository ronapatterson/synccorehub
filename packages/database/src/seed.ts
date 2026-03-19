/**
 * Database seed script — populates the database with initial data for development.
 * Run: pnpm db:seed
 */
import { db } from "./client";
import { plans, plugins } from "./schema";

type PlanInsert = typeof plans.$inferInsert;
type PluginInsert = typeof plugins.$inferInsert;

async function main() {
  console.log("🌱 Seeding database...");

  // ── Plans ──────────────────────────────────────────────────────────────
  const planData: PlanInsert[] = [
    {
      name: "Free",
      tier: "free",
      monthlyPrice: 0,
      yearlyPrice: 0,
      maxUsers: 3,
      maxCustomers: 100,
      maxProjects: 5,
      maxPlugins: 1,
      features: ["CRM Core", "Customer Portal (1 project)", "Email support"],
      isActive: true,
    },
    {
      name: "Starter",
      tier: "starter",
      monthlyPrice: 4900,  // $49/mo
      yearlyPrice: 47040,  // $3920/yr ($392/mo × 10)
      maxUsers: 10,
      maxCustomers: 1000,
      maxProjects: 20,
      maxPlugins: 5,
      features: [
        "Everything in Free",
        "ICP Builder",
        "Lead Pipeline",
        "Contractor Management",
        "Referral System",
        "Priority support",
      ],
      isActive: true,
    },
    {
      name: "Growth",
      tier: "growth",
      monthlyPrice: 14900, // $149/mo
      yearlyPrice: 143040, // $11920/yr
      maxUsers: 50,
      maxCustomers: 10000,
      maxProjects: 100,
      maxPlugins: 20,
      features: [
        "Everything in Starter",
        "Advanced Analytics",
        "Custom Domains",
        "Plugin Marketplace",
        "Webhook Integrations",
        "API Access",
        "Dedicated support",
      ],
      isActive: true,
    },
    {
      name: "Enterprise",
      tier: "enterprise",
      monthlyPrice: 0, // Custom pricing
      yearlyPrice: 0,
      maxUsers: null, // unlimited
      maxCustomers: null,
      maxProjects: null,
      maxPlugins: null,
      features: [
        "Everything in Growth",
        "Unlimited everything",
        "White-label portal",
        "Custom integrations",
        "SLA guarantee",
        "Dedicated account manager",
      ],
      isActive: true,
    },
  ];
  await db.insert(plans).values(planData).onConflictDoNothing();

  // ── Sample Plugins ─────────────────────────────────────────────────────
  const pluginData: PluginInsert[] = [
    {
      slug: "slack-notifications",
      name: "Slack Notifications",
      description: "Send CRM events to Slack channels",
      version: "1.0.0",
      author: "SyncCoreHub",
      isOfficial: true,
      isFree: true,
      category: "communication",
      tags: ["slack", "notifications", "communication"],
      requiredScopes: ["webhooks:manage"],
      manifest: {
        id: "slack-notifications",
        version: "1.0.0",
        apiVersion: "1.0",
        hooks: ["crm:customer-created", "crm:lead-stage-changed", "portal:project-status-changed"],
        configSchema: {
          webhookUrl: { type: "string", label: "Slack Webhook URL", required: true, secret: true },
          channel: { type: "string", label: "Channel (optional override)", required: false },
        },
      },
    },
    {
      slug: "google-calendar-sync",
      name: "Google Calendar Sync",
      description: "Sync activities and project milestones to Google Calendar",
      version: "1.0.0",
      author: "SyncCoreHub",
      isOfficial: true,
      isFree: false,
      priceCents: "900",
      category: "productivity",
      tags: ["google", "calendar", "scheduling"],
      requiredScopes: ["customers:read", "projects:read"],
      manifest: {
        id: "google-calendar-sync",
        version: "1.0.0",
        apiVersion: "1.0",
        hooks: ["portal:milestone-completed", "crm:customer-created"],
        configSchema: {
          clientId: { type: "string", label: "Google OAuth Client ID", required: true, secret: false },
          clientSecret: { type: "string", label: "Google OAuth Client Secret", required: true, secret: true },
        },
      },
    },
    {
      slug: "stripe-invoicing",
      name: "Stripe Invoicing",
      description: "Automatically create Stripe invoices from approved time entries",
      version: "1.0.0",
      author: "SyncCoreHub",
      isOfficial: true,
      isFree: false,
      priceCents: "1900",
      category: "finance",
      tags: ["stripe", "invoicing", "billing"],
      requiredScopes: ["customers:read", "projects:read"],
      manifest: {
        id: "stripe-invoicing",
        version: "1.0.0",
        apiVersion: "1.0",
        configSchema: {
          stripeSecretKey: { type: "string", label: "Stripe Secret Key", required: true, secret: true },
        },
      },
    },
    {
      slug: "smart-call-routing",
      name: "Smart Call Routing",
      description: "Route missed calls to an IVR that collects caller info and sends a scheduling link via SMS.",
      longDescription: "Assign a Twilio virtual number to any team member. When a call goes unanswered, an IVR collects the caller's name and callback number, then sends an SMS with a token-gated scheduling link. Slots are auto-computed from the recipient's availability and synced with Google Calendar or Microsoft Outlook to avoid double-booking.",
      version: "1.0.0",
      author: "SyncCoreHub",
      isOfficial: true,
      isFeatured: true,
      isFree: false,
      priceCents: "2900",
      category: "communication",
      tags: ["twilio", "phone", "scheduling", "calendar", "ivr", "sms"],
      requiredScopes: ["customers:write"],
      manifest: {
        id: "smart-call-routing",
        version: "1.0.0",
        apiVersion: "1.0",
        hooks: ["call:missed", "call:scheduled"],
        routes: [{ path: "/settings/call-routing", label: "Call Routing", icon: "PhoneForwarded" }],
        configSchema: {
          twilioAccountSid: { type: "string", label: "Twilio Account SID", required: true, secret: true, placeholder: "ACxxxxxxxx" },
          twilioAuthToken: { type: "string", label: "Twilio Auth Token", required: true, secret: true },
          twilioMessagingServiceSid: { type: "string", label: "Twilio Messaging Service SID", required: false, secret: false },
          googleClientId: { type: "string", label: "Google OAuth Client ID", required: false, secret: false },
          googleClientSecret: { type: "string", label: "Google OAuth Client Secret", required: false, secret: true },
          microsoftClientId: { type: "string", label: "Microsoft OAuth Client ID", required: false, secret: false },
          microsoftClientSecret: { type: "string", label: "Microsoft OAuth Client Secret", required: false, secret: true },
          microsoftTenantId: { type: "string", label: "Microsoft Tenant ID", required: false, secret: false, placeholder: "common" },
          schedulingPageBaseUrl: { type: "url", label: "App Base URL", required: true, secret: false },
          schedulingLinkTtlHours: { type: "number", label: "Scheduling Link Expiry (hours)", required: false, secret: false, placeholder: "48" },
          ivrWelcomeMessage: { type: "string", label: "IVR Welcome Message", required: false, secret: false },
        },
      },
    },
  ];
  await db.insert(plugins).values(pluginData).onConflictDoNothing();

  console.log("✅ Seed complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
