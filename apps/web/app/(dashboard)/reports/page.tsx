"use client";
import { trpc } from "@/lib/trpc";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308"];

export default function ReportsPage() {
  const { data: kpis } = trpc.analytics.dashboardKpis.useQuery();
  const { data: icpDist } = trpc.analytics.icpScoreDistribution.useQuery();
  const { data: velocity } = trpc.analytics.leadVelocity.useQuery();

  const conversionRate =
    kpis && kpis.totalLeads > 0
      ? ((kpis.wonLeads / kpis.totalLeads) * 100).toFixed(1)
      : "0.0";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Insights across your CRM, pipeline, and ICP performance.
        </p>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Customers", value: kpis?.totalCustomers ?? "—" },
          { label: "ICP Match %", value: kpis?.icpMatchRate !== undefined ? `${Math.round(kpis.icpMatchRate)}%` : "—" },
          { label: "Pipeline Value", value: kpis?.pipelineValueCents !== undefined ? `$${(kpis.pipelineValueCents / 100).toLocaleString()}` : "—" },
          { label: "Conversion Rate", value: `${conversionRate}%` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-card border rounded-xl p-5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      {/* Lead Velocity Chart */}
      <div className="bg-card border rounded-xl p-5">
        <h2 className="font-semibold mb-4">Lead Velocity (last 12 weeks)</h2>
        {velocity && velocity.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={velocity}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                labelFormatter={(v) => new Date(v as string).toLocaleDateString()}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend iconType="circle" iconSize={8} />
              <Line
                type="monotone"
                dataKey="new_leads"
                name="New Leads"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="won_leads"
                name="Won"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="lost_leads"
                name="Lost"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
            Not enough data yet.
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ICP Score Distribution */}
        <div className="bg-card border rounded-xl p-5">
          <h2 className="font-semibold mb-4">ICP Score Distribution</h2>
          {icpDist && icpDist.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={icpDist}
                    dataKey="count"
                    nameKey="bucket"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                  >
                    {icpDist.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {icpDist.map((entry, i) => (
                  <div key={entry.bucket} className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-sm flex-1">{entry.bucket}</span>
                    <span className="text-sm font-semibold">{entry.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              No ICP data available.
            </div>
          )}
        </div>

        {/* Pipeline by stage */}
        <div className="bg-card border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Pipeline Overview</h2>
          <div className="space-y-3">
            {kpis ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total leads</span>
                  <span className="font-medium">{kpis.totalLeads}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Won leads</span>
                  <span className="font-medium text-emerald-500">{kpis.wonLeads}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Active projects</span>
                  <span className="font-medium">{kpis.activeProjects}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pipeline value</span>
                  <span className="font-medium">
                    ${((kpis.pipelineValueCents ?? 0) / 100).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Conversion rate</span>
                  <span className="font-medium">{conversionRate}%</span>
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Loading…</div>
            )}
          </div>

          {velocity && velocity.length > 0 && (
            <>
              <h3 className="font-medium text-sm mt-6 mb-3">Weekly new leads (bar)</h3>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={velocity} barSize={14}>
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v) =>
                      new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    }
                  />
                  <Tooltip
                    labelFormatter={(v) => new Date(v as string).toLocaleDateString()}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="new_leads" name="New Leads" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
