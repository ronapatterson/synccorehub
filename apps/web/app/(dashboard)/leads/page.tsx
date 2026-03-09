"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, Trophy, XCircle } from "lucide-react";
import { toast } from "sonner";
import { formatCents } from "@/lib/utils";
import { Badge } from "@synccorehub/ui";

export default function LeadsPage() {
  const { data: pipelines, isLoading } = trpc.leads.pipelinesWithLeads.useQuery();
  const markWon = trpc.leads.markWon.useMutation({ onSuccess: () => toast.success("Lead marked as won!") });
  const markLost = trpc.leads.markLost.useMutation({ onSuccess: () => toast.error("Lead marked as lost") });
  const utils = trpc.useUtils();

  const moveToStage = trpc.leads.moveToStage.useMutation({
    onSuccess: () => utils.leads.pipelinesWithLeads.invalidate(),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted rounded w-32 animate-pulse" />
        <div className="flex gap-4 overflow-x-auto">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="w-72 shrink-0 bg-muted rounded-xl h-96 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const pipeline = pipelines?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Lead Pipeline</h1>
          <p className="text-muted-foreground text-sm mt-1">{pipeline?.name ?? "Default Pipeline"}</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          Add lead
        </button>
      </div>

      {/* Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {pipeline?.stages.map((stage) => (
          <div key={stage.id} className="w-72 shrink-0">
            {/* Stage header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color ?? "#6366f1" }} />
                <span className="text-sm font-medium">{stage.name}</span>
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{stage.leads.length}</span>
              </div>
              {stage.winProbability != null && (
                <span className="text-xs text-muted-foreground">{stage.winProbability}%</span>
              )}
            </div>

            {/* Cards */}
            <div className="space-y-2.5">
              {stage.leads.map((lead) => (
                <div key={lead.id} className="bg-card border rounded-xl p-4 hover:border-primary/40 transition-colors group">
                  <p className="font-medium text-sm mb-1">{lead.title}</p>
                  {lead.value && (
                    <p className="text-indigo-600 font-semibold text-sm">{formatCents(lead.value)}</p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    {lead.expectedCloseDate && (
                      <span className="text-xs text-muted-foreground">
                        Close: {new Date(lead.expectedCloseDate).toLocaleDateString()}
                      </span>
                    )}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => markWon.mutate({ id: lead.id })}
                        className="p-1 rounded hover:bg-emerald-100 text-emerald-600"
                        title="Mark won"
                      >
                        <Trophy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => markLost.mutate({ id: lead.id })}
                        className="p-1 rounded hover:bg-red-100 text-red-500"
                        title="Mark lost"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {stage.leads.length === 0 && (
                <div className="border-2 border-dashed rounded-xl p-6 text-center">
                  <p className="text-xs text-muted-foreground">No leads</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
