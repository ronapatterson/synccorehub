"use client";
import { trpc } from "@/lib/trpc";
import { Badge } from "@synccorehub/ui";
import { Gift, TrendingUp, CheckCircle2, XCircle, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeDate } from "@/lib/utils";

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "secondary" | "success" | "destructive" | "warning"; icon: React.ReactNode }
> = {
  pending: { label: "Pending", variant: "secondary", icon: <Clock className="h-3.5 w-3.5" /> },
  qualified: { label: "Qualified", variant: "warning", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  rewarded: { label: "Rewarded", variant: "success", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  rejected: { label: "Rejected", variant: "destructive", icon: <XCircle className="h-3.5 w-3.5" /> },
};

export default function ReferralsPage() {
  const { data, isLoading, refetch } = trpc.referrals.listReferrals.useQuery();
  const qualifyReferral = trpc.referrals.qualifyReferral.useMutation({
    onSuccess: () => { toast.success("Referral qualified and reward issued"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const totalPending = data?.filter((r) => r.status === "pending").length ?? 0;
  const totalQualified = data?.filter((r) => r.status === "qualified").length ?? 0;
  const totalRewarded = data?.filter((r) => r.status === "rewarded").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Referrals</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track customer referrals and manage reward qualification.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Referrals", value: data?.length ?? 0, icon: <Users className="h-4 w-4 text-primary" /> },
          { label: "Pending Review", value: totalPending, icon: <Clock className="h-4 w-4 text-amber-500" /> },
          { label: "Qualified", value: totalQualified, icon: <TrendingUp className="h-4 w-4 text-blue-500" /> },
          { label: "Rewarded", value: totalRewarded, icon: <Gift className="h-4 w-4 text-emerald-500" /> },
        ].map(({ label, value, icon }) => (
          <div key={label} className="bg-card border rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
              {icon}
            </div>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Referral table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b bg-muted/30">
          <p className="text-sm font-semibold">All Referrals</p>
        </div>

        {isLoading ? (
          <div className="space-y-0 divide-y">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Gift className="h-10 w-10 text-muted-foreground mb-4" />
            <p className="font-medium">No referrals yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Referrals appear here once portal users share their links.
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {data.map((referral) => {
              const config = STATUS_CONFIG[referral.status] ?? STATUS_CONFIG.pending;
              return (
                <div key={referral.id} className="flex items-center gap-4 px-5 py-3.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {referral.referredEmail ?? `Referral #${referral.id.slice(0, 8).toUpperCase()}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Code: <span className="font-mono">{referral.referralCode?.code ?? "—"}</span> ·{" "}
                      {formatRelativeDate(new Date(referral.createdAt))}
                    </p>
                  </div>

                  {referral.rewardPoints !== null && (
                    <span className="text-sm font-semibold text-emerald-500 shrink-0">
                      {referral.rewardPoints > 0 ? `+${referral.rewardPoints} pts` : "—"}
                    </span>
                  )}

                  <Badge variant={config.variant} className="text-xs gap-1 shrink-0">
                    {config.icon}
                    {config.label}
                  </Badge>

                  {referral.status === "pending" && (
                    <button
                      onClick={() =>
                        qualifyReferral.mutate({
                          referralId: referral.id,
                          rewardPoints: 100,
                        })
                      }
                      disabled={qualifyReferral.isPending}
                      className="text-xs font-medium text-primary hover:underline shrink-0 disabled:opacity-50"
                    >
                      Qualify
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
