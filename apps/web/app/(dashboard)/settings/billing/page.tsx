"use client";
import { trpc } from "@/lib/trpc";
import { Badge } from "@synccorehub/ui";
import { CheckCircle2, CreditCard, Zap } from "lucide-react";

const PLAN_FEATURES: Record<string, string[]> = {
  free: ["Up to 500 customers", "1 pipeline", "Basic reports", "Community support"],
  starter: ["Up to 2,500 customers", "3 pipelines", "Advanced reports", "Email support", "Portal for 5 customers"],
  growth: ["Unlimited customers", "Unlimited pipelines", "Full analytics", "Priority support", "Portal unlimited", "5 plugins"],
  enterprise: ["Everything in Growth", "Custom domain", "SSO / SAML", "Dedicated support", "SLA", "Unlimited plugins"],
};

const PLAN_PRICES: Record<string, string> = {
  free: "$0/mo",
  starter: "$49/mo",
  growth: "$149/mo",
  enterprise: "Custom",
};

export default function BillingPage() {
  const { data: tenant } = trpc.tenants.current.useQuery();
  const { data: subscription } = trpc.tenants.subscription.useQuery();

  const currentTier = subscription?.plan?.tier ?? "free";

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Billing & Plan</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your subscription and invoices.</p>
      </div>

      {/* Current plan */}
      <section className="bg-card border rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Current Plan</h2>
          <Badge
            variant={currentTier === "free" ? "secondary" : "success"}
            className="capitalize"
          >
            {currentTier}
          </Badge>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold capitalize">{currentTier} Plan</p>
            <p className="text-sm text-muted-foreground">{PLAN_PRICES[currentTier] ?? "—"}</p>
          </div>
        </div>

        {subscription && (
          <div className="space-y-1 text-sm text-muted-foreground">
            {subscription.currentPeriodStart && (
              <p>
                Period: {new Date(subscription.currentPeriodStart).toLocaleDateString()} —{" "}
                {subscription.currentPeriodEnd
                  ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                  : "ongoing"}
              </p>
            )}
            <p>
              Status:{" "}
              <span className={`font-medium ${subscription.status === "active" ? "text-emerald-500" : "text-amber-500"}`}>
                {subscription.status}
              </span>
            </p>
          </div>
        )}

        <ul className="mt-4 space-y-1.5">
          {(PLAN_FEATURES[currentTier] ?? []).map((feature) => (
            <li key={feature} className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
      </section>

      {/* Plan upgrade cards */}
      <section>
        <h2 className="font-semibold mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(["starter", "growth", "enterprise"] as const).map((tier) => (
            <div
              key={tier}
              className={`border rounded-xl p-5 ${tier === "growth" ? "border-primary ring-1 ring-primary/30" : ""}`}
            >
              {tier === "growth" && (
                <div className="text-xs font-semibold text-primary mb-2 uppercase tracking-wide">
                  Most Popular
                </div>
              )}
              <p className="font-semibold capitalize mb-0.5">{tier}</p>
              <p className="text-xl font-bold mb-3">{PLAN_PRICES[tier]}</p>
              <ul className="space-y-1.5 mb-4">
                {PLAN_FEATURES[tier]?.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              {currentTier === tier ? (
                <button disabled className="w-full py-2 rounded-lg text-sm font-medium bg-muted text-muted-foreground">
                  Current plan
                </button>
              ) : (
                <button className="w-full py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  {tier === "enterprise" ? "Contact sales" : "Upgrade"}
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Payment method */}
      {tenant?.stripeCustomerId && (
        <section className="bg-card border rounded-xl p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Payment Method
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Manage your payment methods via the Stripe billing portal.
          </p>
          <button className="text-sm font-medium text-primary hover:underline">
            Open billing portal →
          </button>
        </section>
      )}
    </div>
  );
}
