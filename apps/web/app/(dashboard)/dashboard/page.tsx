"use client";
import { trpc } from "@/lib/trpc";
import { formatCents } from "@/lib/utils";
import { Users, GitBranch, FolderKanban, TrendingUp, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const SCORE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e"];

export default function DashboardPage() {
  const { data: kpis, isLoading } = trpc.analytics.dashboardKpis.useQuery();
  const { data: distribution } = trpc.analytics.icpScoreDistribution.useQuery();
  const { data: velocity } = trpc.analytics.leadVelocity.useQuery();

  const kpiCards = kpis
    ? [
        { label: "Total Customers", value: kpis.totalCustomers.toLocaleString(), icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
        { label: "ICP Match Rate", value: `${kpis.icpMatchedPct}%`, sub: `${kpis.icpMatchedCount} customers`, icon: Target, color: "text-indigo-600", bg: "bg-indigo-50" },
        { label: "Open Leads", value: kpis.openLeads.toLocaleString(), icon: GitBranch, color: "text-amber-600", bg: "bg-amber-50" },
        { label: "Pipeline Value", value: formatCents(kpis.pipelineValue), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
        { label: "Active Projects", value: kpis.activeProjects.toLocaleString(), icon: FolderKanban, color: "text-purple-600", bg: "bg-purple-50" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your business metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {isLoading
          ? Array(5).fill(0).map((_, i) => (
              <div key={i} className="bg-card border rounded-xl p-5 animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                <div className="h-7 bg-muted rounded w-1/2" />
              </div>
            ))
          : kpiCards.map((card) => (
              <div key={card.label} className="bg-card border rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-muted-foreground text-xs font-medium">{card.label}</span>
                  <div className={`h-8 w-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`h-4 w-4 ${card.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold">{card.value}</p>
                {card.sub && <p className="text-muted-foreground text-xs mt-0.5">{card.sub}</p>}
              </div>
            ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Velocity */}
        <div className="lg:col-span-2 bg-card border rounded-xl p-6">
          <h2 className="font-semibold mb-4">Won Deals — Last 12 Weeks</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={velocity ?? []}>
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ICP Score Distribution */}
        <div className="bg-card border rounded-xl p-6">
          <h2 className="font-semibold mb-4">ICP Score Distribution</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={distribution ?? []} dataKey="count" nameKey="bucket" cx="50%" cy="50%" outerRadius={80} label={({ bucket }) => bucket}>
                {(distribution ?? []).map((_, i) => (
                  <Cell key={i} fill={SCORE_COLORS[i % SCORE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
