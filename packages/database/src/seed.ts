/**
 * Database seed script — populates the database with initial data for development.
 * Run: pnpm db:seed
 */
import { db } from "./client";
import { plans, plugins } from "./schema";

async function main() {
  console.log("🌱 Seeding database...");

  // ── Plans ──────────────────────────────────────────────────────────────
  await db.insert(plans).values([
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
  ]).onConflictDoNothing();

  // ── Sample Plugins ─────────────────────────────────────────────────────
  await db.insert(plugins).values([
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
  ]).onConflictDoNothing();

  console.log("✅ Seed complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
