"use client";
import { trpc } from "@/lib/trpc";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@synccorehub/ui";
import { ArrowLeft, ChevronRight, Clock, CheckCircle2, XCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeDate } from "@/lib/utils";

const TIME_ENTRY_STATUS_VARIANTS: Record<string, "secondary" | "success" | "destructive" | "warning"> = {
  draft: "secondary",
  submitted: "warning",
  approved: "success",
  rejected: "destructive",
  invoiced: "secondary",
};

export default function ContractorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [showLogTime, setShowLogTime] = useState(false);
  const [timeForm, setTimeForm] = useState({
    description: "",
    startedAt: "",
    endedAt: "",
    billable: true,
  });

  const { data: contractor, isLoading } = trpc.contractors.byId.useQuery({ id });
  const { data: timeEntries, refetch: refetchTime } = trpc.contractors.listTimeEntries.useQuery({
    contractorId: id,
  });

  const logTimeEntry = trpc.contractors.logTimeEntry.useMutation({
    onSuccess: () => {
      toast.success("Time entry logged");
      setShowLogTime(false);
      setTimeForm({ description: "", startedAt: "", endedAt: "", billable: true });
      refetchTime();
    },
  });

  const approveTimeEntry = trpc.contractors.approveTimeEntry.useMutation({
    onSuccess: () => { toast.success("Time entry approved"); refetchTime(); },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-muted rounded w-40" />
        <div className="h-32 bg-muted rounded-xl" />
      </div>
    );
  }

  if (!contractor) {
    return <div className="text-center py-20 text-muted-foreground">Contractor not found.</div>;
  }

  const totalBillableHours =
    timeEntries
      ?.filter((e) => e.isBillable && e.status === "approved")
      .reduce((sum, e) => {
        if (!e.startedAt || !e.endedAt) return sum;
        const hours =
          (new Date(e.endedAt).getTime() - new Date(e.startedAt).getTime()) / 3_600_000;
        return sum + hours;
      }, 0) ?? 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => router.back()} className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Contractors
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{contractor.name}</span>
      </div>

      {/* Profile */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
              {contractor.name[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold">{contractor.name}</h1>
              <p className="text-muted-foreground text-sm capitalize">
                {contractor.type} · {contractor.email}
              </p>
            </div>
          </div>
          <Badge
            variant={
              contractor.status === "active"
                ? "success"
                : contractor.status === "pending_onboarding"
                  ? "warning"
                  : "secondary"
            }
            className="capitalize"
          >
            {contractor.status.replace("_", " ")}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t">
          {contractor.hourlyRateCents !== null && (
            <div>
              <p className="text-xs text-muted-foreground">Hourly rate</p>
              <p className="font-semibold">${(contractor.hourlyRateCents / 100).toFixed(2)}/hr</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Approved hours</p>
            <p className="font-semibold">{totalBillableHours.toFixed(1)} hrs</p>
          </div>
          {contractor.contractStartDate && (
            <div>
              <p className="text-xs text-muted-foreground">Start date</p>
              <p className="font-semibold">
                {new Date(contractor.contractStartDate).toLocaleDateString()}
              </p>
            </div>
          )}
          {contractor.contractEndDate && (
            <div>
              <p className="text-xs text-muted-foreground">End date</p>
              <p className="font-semibold">
                {new Date(contractor.contractEndDate).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>

        {contractor.skills && contractor.skills.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground mb-2">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {contractor.skills.map((skill) => (
                <span key={skill} className="text-xs bg-muted px-2.5 py-1 rounded-full font-medium">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Time entries */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Time Entries</h2>
          <button
            onClick={() => setShowLogTime(!showLogTime)}
            className="flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Log time
          </button>
        </div>

        {showLogTime && (
          <div className="mb-4 bg-card border rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5">Start time *</label>
                <input
                  type="datetime-local"
                  value={timeForm.startedAt}
                  onChange={(e) => setTimeForm({ ...timeForm, startedAt: e.target.value })}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">End time *</label>
                <input
                  type="datetime-local"
                  value={timeForm.endedAt}
                  onChange={(e) => setTimeForm({ ...timeForm, endedAt: e.target.value })}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5">Description</label>
                <input
                  value={timeForm.description}
                  onChange={(e) => setTimeForm({ ...timeForm, description: e.target.value })}
                  placeholder="What was worked on?"
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="billable"
                  checked={timeForm.billable}
                  onChange={(e) => setTimeForm({ ...timeForm, billable: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="billable" className="text-sm font-medium">Billable</label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowLogTime(false)}
                className="text-sm px-3 py-1.5 rounded-lg border hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  logTimeEntry.mutate({
                    contractorId: id,
                    description: timeForm.description,
                    startedAt: new Date(timeForm.startedAt).toISOString(),
                    endedAt: new Date(timeForm.endedAt).toISOString(),
                    billable: timeForm.billable,
                  })
                }
                disabled={!timeForm.startedAt || !timeForm.endedAt || logTimeEntry.isPending}
                className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
              >
                {logTimeEntry.isPending ? "Saving…" : "Log entry"}
              </button>
            </div>
          </div>
        )}

        <div className="bg-card border rounded-xl divide-y">
          {!timeEntries || timeEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Clock className="h-8 w-8 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No time entries yet.</p>
            </div>
          ) : (
            timeEntries.map((entry) => {
              const hours =
                entry.startedAt && entry.endedAt
                  ? (
                      (new Date(entry.endedAt).getTime() - new Date(entry.startedAt).getTime()) /
                      3_600_000
                    ).toFixed(1)
                  : null;

              return (
                <div key={entry.id} className="flex items-center gap-4 px-5 py-3.5">
                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{entry.description ?? "Time entry"}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.startedAt
                        ? formatRelativeDate(new Date(entry.startedAt))
                        : "—"}{" "}
                      {hours !== null && `· ${hours} hrs`}
                      {entry.isBillable ? " · Billable" : " · Non-billable"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={TIME_ENTRY_STATUS_VARIANTS[entry.status] ?? "secondary"}
                      className="text-xs capitalize"
                    >
                      {entry.status}
                    </Badge>
                    {entry.status === "submitted" && (
                      <div className="flex gap-1">
                        <button
                          onClick={() =>
                            approveTimeEntry.mutate({ timeEntryId: entry.id, approved: true })
                          }
                          className="text-emerald-600 hover:text-emerald-700"
                          title="Approve"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() =>
                            approveTimeEntry.mutate({ timeEntryId: entry.id, approved: false })
                          }
                          className="text-red-500 hover:text-red-600"
                          title="Reject"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
