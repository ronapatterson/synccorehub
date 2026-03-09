"use client";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Badge } from "@synccorehub/ui";
import { Plus, Users, Filter, Layers, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatRelativeDate } from "@/lib/utils";

export default function SegmentsPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    segmentType: "static" as "static" | "dynamic",
  });

  const { data, isLoading, refetch } = trpc.segments.list.useQuery();
  const createSegment = trpc.segments.create.useMutation({
    onSuccess: () => {
      toast.success("Segment created");
      setShowForm(false);
      setForm({ name: "", description: "", segmentType: "static" });
      refetch();
    },
  });
  const deleteSegment = trpc.segments.delete.useMutation({
    onSuccess: () => { toast.success("Segment deleted"); refetch(); },
  });

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Segments</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Group customers into static lists or dynamic filter-based segments.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> New segment
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold">New Segment</h2>
          <div>
            <label className="block text-sm font-medium mb-1.5">Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Enterprise prospects"
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What's this segment for?"
              className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Type</label>
            <div className="flex gap-3">
              {(["static", "dynamic"] as const).map((type) => (
                <label
                  key={type}
                  className={`flex-1 border rounded-xl p-3 cursor-pointer transition-colors ${form.segmentType === type ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                >
                  <input
                    type="radio"
                    name="segmentType"
                    value={type}
                    checked={form.segmentType === type}
                    onChange={() => setForm({ ...form, segmentType: type })}
                    className="sr-only"
                  />
                  <div className="flex items-center gap-2 mb-1">
                    {type === "static" ? (
                      <Layers className="h-4 w-4 text-primary" />
                    ) : (
                      <Filter className="h-4 w-4 text-primary" />
                    )}
                    <span className="text-sm font-medium capitalize">{type}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {type === "static"
                      ? "Manually curated list of customers"
                      : "Auto-updates based on filter rules"}
                  </p>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="text-sm px-4 py-2 rounded-lg border hover:bg-muted"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                createSegment.mutate({
                  name: form.name,
                  description: form.description || undefined,
                  segmentType: form.segmentType,
                })
              }
              disabled={!form.name || createSegment.isPending}
              className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {createSegment.isPending ? "Creating…" : "Create segment"}
            </button>
          </div>
        </div>
      )}

      {/* Segment list */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="font-medium">No segments yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create segments to group and target customers.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((segment) => (
            <div
              key={segment.id}
              className="bg-card border rounded-xl p-5 flex items-center gap-4"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                {segment.segmentType === "dynamic" ? (
                  <Filter className="h-4 w-4 text-primary" />
                ) : (
                  <Layers className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{segment.name}</p>
                  <Badge variant="secondary" className="text-xs capitalize">
                    {segment.segmentType}
                  </Badge>
                </div>
                {segment.description && (
                  <p className="text-sm text-muted-foreground truncate">{segment.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">
                  Updated {formatRelativeDate(new Date(segment.updatedAt))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {segment.memberCount ?? 0} members
                </span>
                <button
                  onClick={() => {
                    if (confirm("Delete this segment?")) {
                      deleteSegment.mutate({ id: segment.id });
                    }
                  }}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
