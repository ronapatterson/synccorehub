"use client";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Badge } from "@synccorehub/ui";
import { Plus, Search, HardHat, Clock, DollarSign } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

const STATUS_VARIANTS: Record<string, "secondary" | "success" | "destructive" | "warning"> = {
  active: "success",
  inactive: "secondary",
  pending_onboarding: "warning",
};

export default function ContractorsPage() {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    type: "individual",
    hourlyRateCents: "",
    skills: "",
  });

  const { data, isLoading, refetch } = trpc.contractors.list.useQuery({
    search: search || undefined,
  });

  const createContractor = trpc.contractors.create.useMutation({
    onSuccess: () => {
      toast.success("Contractor added");
      setShowForm(false);
      setForm({ name: "", email: "", type: "individual", hourlyRateCents: "", skills: "" });
      refetch();
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contractors</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your sub-contractors and assignments.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add contractor
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-card border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold">New Contractor</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Full name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Jane Smith"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Email *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@agency.com"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="individual">Individual</option>
                <option value="agency">Agency</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Hourly rate (cents)</label>
              <input
                type="number"
                value={form.hourlyRateCents}
                onChange={(e) => setForm({ ...form, hourlyRateCents: e.target.value })}
                placeholder="5000"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Skills (comma-separated)</label>
              <input
                value={form.skills}
                onChange={(e) => setForm({ ...form, skills: e.target.value })}
                placeholder="React, TypeScript, Node.js"
                className="w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setShowForm(false)}
              className="text-sm px-4 py-2 rounded-lg border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                createContractor.mutate({
                  name: form.name,
                  email: form.email,
                  type: form.type as "individual" | "agency",
                  hourlyRateCents: form.hourlyRateCents ? parseInt(form.hourlyRateCents) : undefined,
                  skills: form.skills
                    ? form.skills.split(",").map((s) => s.trim()).filter(Boolean)
                    : undefined,
                })
              }
              disabled={!form.name || !form.email || createContractor.isPending}
              className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {createContractor.isPending ? "Saving…" : "Add contractor"}
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search contractors…"
          className="w-full pl-9 pr-3 py-2 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <HardHat className="h-10 w-10 text-muted-foreground mb-4" />
          <p className="font-medium">No contractors yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add your first contractor to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map((contractor) => (
            <Link
              key={contractor.id}
              href={`/contractors/${contractor.id}`}
              className="bg-card border rounded-xl p-5 hover:shadow-sm transition-shadow block"
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {contractor.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{contractor.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {contractor.type}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={STATUS_VARIANTS[contractor.status] ?? "secondary"}
                  className="text-xs capitalize shrink-0"
                >
                  {contractor.status.replace("_", " ")}
                </Badge>
              </div>

              {contractor.email && (
                <p className="text-xs text-muted-foreground mb-2 truncate">{contractor.email}</p>
              )}

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {contractor.hourlyRateCents !== null && (
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    ${(contractor.hourlyRateCents / 100).toFixed(0)}/hr
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {contractor.type === "individual" ? "Freelancer" : "Agency"}
                </span>
              </div>

              {contractor.skills && contractor.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {contractor.skills.slice(0, 3).map((skill) => (
                    <span
                      key={skill}
                      className="text-xs bg-muted px-2 py-0.5 rounded-full"
                    >
                      {skill}
                    </span>
                  ))}
                  {contractor.skills.length > 3 && (
                    <span className="text-xs text-muted-foreground">
                      +{contractor.skills.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
