"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, Search } from "lucide-react";
import { Badge } from "@synccorehub/ui";
import Link from "next/link";
import { formatRelativeDate, getInitials } from "@/lib/utils";

const STATUS_COLORS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  active: "success",
  prospect: "info" as never,
  inactive: "secondary",
  churned: "destructive",
};

export default function CustomersPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [, setShowForm] = useState(false);
  const { data, isLoading } = trpc.customers.list.useQuery({
    page,
    search: search || undefined,
    status: status as never || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.total ?? 0} total customers</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add customer
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, email, company…"
            className="w-full pl-9 pr-4 py-2 border border-input rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="border border-input rounded-lg text-sm px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="prospect">Prospect</option>
          <option value="inactive">Inactive</option>
          <option value="churned">Churned</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Customer</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden md:table-cell">Company</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell">ICP Score</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
              <th className="text-left py-3 px-4 font-medium text-muted-foreground hidden lg:table-cell">Added</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading
              ? Array(8).fill(0).map((_, i) => (
                  <tr key={i}>
                    {Array(5).fill(0).map((_, j) => (
                      <td key={j} className="py-3 px-4">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : data?.data.map((customer) => (
                  <tr key={customer.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4">
                      <Link href={`/customers/${customer.id}`} className="flex items-center gap-3 hover:text-primary">
                        <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-medium text-xs shrink-0">
                          {getInitials((`${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() || customer.email) ?? "?")}
                        </div>
                        <div>
                          <p className="font-medium">{[customer.firstName, customer.lastName].filter(Boolean).join(" ") || "—"}</p>
                          <p className="text-muted-foreground text-xs">{customer.email ?? ""}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell text-muted-foreground">{customer.company ?? "—"}</td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {customer.icpScore != null ? (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${customer.icpScore}%` }} />
                          </div>
                          <span className="text-xs font-medium">{Math.round(customer.icpScore)}</span>
                        </div>
                      ) : <span className="text-muted-foreground text-xs">Unscored</span>}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={STATUS_COLORS[customer.status] ?? "secondary"}>{customer.status}</Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground text-xs hidden lg:table-cell">
                      {formatRelativeDate(customer.createdAt)}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, data.total)} of {data.total}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border rounded text-xs disabled:opacity-50 hover:bg-muted transition-colors">Previous</button>
              <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages} className="px-3 py-1.5 border rounded text-xs disabled:opacity-50 hover:bg-muted transition-colors">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
