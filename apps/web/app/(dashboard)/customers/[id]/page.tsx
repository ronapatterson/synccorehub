"use client";
import { trpc } from "@/lib/trpc";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@synccorehub/ui";
import {
  ChevronRight,
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  Star,
  Pencil,
  ArrowLeft,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { formatRelativeDate } from "@/lib/utils";

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  note: "Note",
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  demo: "Demo",
  task: "Task",
  status_change: "Status Change",
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [activityType, setActivityType] = useState<string>("note");
  const [activityContent, setActivityContent] = useState("");
  const [showActivityForm, setShowActivityForm] = useState(false);

  const { data: customer, isLoading } = trpc.customers.byId.useQuery({ id });
  const { data: activitiesData, refetch: refetchActivities } = trpc.activities.list.useQuery({
    customerId: id,
  });

  const createActivity = trpc.activities.create.useMutation({
    onSuccess: () => {
      toast.success("Activity logged");
      setActivityContent("");
      setShowActivityForm(false);
      refetchActivities();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-muted rounded w-48" />
        <div className="h-40 bg-muted rounded-xl" />
        <div className="h-60 bg-muted rounded-xl" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Customer not found.</p>
      </div>
    );
  }

  const displayName = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || customer.email || "Unknown";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => router.back()} className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Customers
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{displayName}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center text-xl font-bold text-primary">
            {displayName[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{displayName}</h1>
            {customer.company && (
              <p className="text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Building2 className="h-3.5 w-3.5" />
                {customer.company}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {customer.icpScore !== null && (
            <div className="flex items-center gap-1 bg-primary/10 text-primary text-sm font-semibold px-3 py-1.5 rounded-lg">
              <Star className="h-3.5 w-3.5" />
              ICP {Math.round(customer.icpScore)}
            </div>
          )}
          <Badge className="capitalize">{customer.status.replace("_", " ")}</Badge>
          <button className="p-2 rounded-lg border hover:bg-muted transition-colors">
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-card border rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-sm">Contact Information</h2>
            {customer.email && (
              <a
                href={`mailto:${customer.email}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <Mail className="h-4 w-4 shrink-0" />
                {customer.email}
              </a>
            )}
            {customer.phone && (
              <a
                href={`tel:${customer.phone}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <Phone className="h-4 w-4 shrink-0" />
                {customer.phone}
              </a>
            )}
            {customer.website && (
              <a
                href={customer.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <Globe className="h-4 w-4 shrink-0" />
                {customer.website}
              </a>
            )}
            {(customer.city || customer.country) && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" />
                {[customer.city, customer.country].filter(Boolean).join(", ")}
              </p>
            )}
          </div>

          {/* Company details */}
          <div className="bg-card border rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-sm">Company Details</h2>
            {customer.industry && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Industry</span>
                <span className="font-medium">{customer.industry}</span>
              </div>
            )}
            {customer.companySize && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Company size</span>
                <span className="font-medium">{customer.companySize}</span>
              </div>
            )}
            {customer.annualRevenue && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Annual revenue</span>
                <span className="font-medium">{customer.annualRevenue}</span>
              </div>
            )}
            {customer.tags && customer.tags.length > 0 && (
              <div>
                <p className="text-muted-foreground text-sm mb-2">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {customer.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs bg-muted px-2 py-0.5 rounded-full font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Activity timeline */}
        <div className="lg:col-span-2">
          <div className="bg-card border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Activity Timeline</h2>
              <button
                onClick={() => setShowActivityForm(!showActivityForm)}
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Log activity
              </button>
            </div>

            {/* Activity form */}
            {showActivityForm && (
              <div className="mb-6 p-4 bg-muted/40 rounded-xl space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(ACTIVITY_TYPE_LABELS).slice(0, 5).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setActivityType(key)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${activityType === key ? "bg-primary text-primary-foreground" : "bg-background border hover:bg-muted"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={activityContent}
                  onChange={(e) => setActivityContent(e.target.value)}
                  placeholder="Add a note, call summary, or outcome…"
                  rows={3}
                  className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setShowActivityForm(false)}
                    className="text-sm px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() =>
                      createActivity.mutate({
                        type: activityType as "note" | "call" | "email" | "meeting" | "demo" | "task" | "custom",
                        customerId: id,
                        content: activityContent,
                      })
                    }
                    disabled={!activityContent.trim() || createActivity.isPending}
                    className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {/* Activity list */}
            {activitiesData && activitiesData.length > 0 ? (
              <div className="space-y-4">
                {activitiesData.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-bold">
                      {ACTIVITY_TYPE_LABELS[activity.type]?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeDate(new Date(activity.createdAt))}
                        </span>
                      </div>
                      {activity.content && (
                        <p className="text-sm text-muted-foreground mt-0.5">{activity.content}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No activity yet. Log the first interaction.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
