import { headers } from "next/headers";
import { db } from "@synccorehub/database/client";
import {
  portalUsers,
  referralCodes,
  referrals,
  rewardAccounts,
  rewardTransactions,
} from "@synccorehub/database/schema";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Badge } from "@synccorehub/ui";
import { Gift, Link2, CheckCircle2, Clock, XCircle, TrendingUp } from "lucide-react";
import { CopyReferralButton } from "./copy-referral-button";

export default async function PortalReferralsPage() {
  const headersList = await headers();
  const portalUserId = headersList.get("x-portal-user-id");
  const tenantId = headersList.get("x-tenant-id");

  if (!portalUserId) notFound();

  // Get portal user to find referral code
  const [portalUser] = await db
    .select()
    .from(portalUsers)
    .where(eq(portalUsers.id, portalUserId))
    .limit(1);

  if (!portalUser) notFound();

  const [referralCode, rewardAccount] = await Promise.all([
    db
      .select()
      .from(referralCodes)
      .where(
        and(
          eq(referralCodes.portalUserId, portalUserId),
          eq(referralCodes.tenantId, tenantId!),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select()
      .from(rewardAccounts)
      .where(
        and(
          eq(rewardAccounts.portalUserId, portalUserId),
          eq(rewardAccounts.tenantId, tenantId!),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
  ]);

  const [myReferrals, transactions] = await Promise.all([
    referralCode
      ? db
          .select()
          .from(referrals)
          .where(eq(referrals.referralCodeId, referralCode.id))
          .orderBy(desc(referrals.createdAt))
      : Promise.resolve([]),
    rewardAccount
      ? db
          .select()
          .from(rewardTransactions)
          .where(eq(rewardTransactions.accountId, rewardAccount.id))
          .orderBy(desc(rewardTransactions.createdAt))
          .limit(20)
      : Promise.resolve([]),
  ]);

  const referralLink = referralCode
    ? `${process.env.PORTAL_URL ?? "http://localhost:3001"}/join?ref=${referralCode.code}`
    : null;

  const STATUS_CONFIG: Record<
    string,
    { label: string; variant: "secondary" | "success" | "destructive" | "warning"; icon: React.ReactNode }
  > = {
    pending: { label: "Pending", variant: "secondary", icon: <Clock className="h-3.5 w-3.5" /> },
    qualified: {
      label: "Qualified",
      variant: "warning",
      icon: <TrendingUp className="h-3.5 w-3.5" />,
    },
    rewarded: {
      label: "Rewarded",
      variant: "success",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    },
    rejected: {
      label: "Rejected",
      variant: "destructive",
      icon: <XCircle className="h-3.5 w-3.5" />,
    },
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Referral Hub</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Earn rewards by referring others to our platform.
        </p>
      </div>

      {/* Reward balance */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
            Reward Balance
          </p>
          <p className="text-3xl font-bold text-primary">
            {rewardAccount?.balance ?? 0}
            <span className="text-base font-normal text-muted-foreground ml-1">pts</span>
          </p>
        </div>
        <div className="bg-card border rounded-xl p-5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
            Total Referrals
          </p>
          <p className="text-3xl font-bold">{myReferrals.length}</p>
        </div>
        <div className="bg-card border rounded-xl p-5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
            Rewarded
          </p>
          <p className="text-3xl font-bold text-emerald-500">
            {myReferrals.filter((r) => r.status === "rewarded").length}
          </p>
        </div>
      </div>

      {/* Referral link */}
      {referralLink ? (
        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-4 w-4 text-primary" />
            <h2 className="font-semibold">Your referral link</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Share this link with anyone who might benefit from our services. You&apos;ll earn
            points when they sign up and get qualified.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-muted rounded-lg px-3 py-2 font-mono truncate">
              {referralLink}
            </code>
            <CopyReferralButton link={referralLink} />
          </div>
          {referralCode && (
            <p className="text-xs text-muted-foreground mt-2">
              Referral code:{" "}
              <span className="font-mono font-medium">{referralCode.code}</span>
            </p>
          )}
        </div>
      ) : (
        <div className="bg-card border rounded-xl p-5 text-center py-10">
          <Gift className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">No referral code yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Contact your account manager to get your referral link.
          </p>
        </div>
      )}

      {/* Referral history */}
      {myReferrals.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-4">Referral History</h2>
          <div className="bg-card border rounded-xl divide-y">
            {myReferrals.map((referral) => {
              const config = STATUS_CONFIG[referral.status] ?? STATUS_CONFIG.pending;
              return (
                <div
                  key={referral.id}
                  className="flex items-center justify-between px-5 py-3.5"
                >
                  <div>
                    <p className="text-sm font-medium">
                      Referral #{referral.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(referral.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {referral.rewardPoints !== null && referral.rewardPoints > 0 && (
                      <span className="text-sm font-semibold text-emerald-500">
                        +{referral.rewardPoints} pts
                      </span>
                    )}
                    <Badge variant={config.variant} className="text-xs gap-1">
                      {config.icon}
                      {config.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transaction history */}
      {transactions.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-4">Reward Transactions</h2>
          <div className="bg-card border rounded-xl divide-y">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium capitalize">
                    {tx.type.replace("_", " ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {tx.description ?? "—"} ·{" "}
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`text-sm font-semibold ${tx.type === "credit" ? "text-emerald-500" : "text-red-500"}`}
                >
                  {tx.type === "credit" ? "+" : "-"}
                  {tx.points} pts
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
