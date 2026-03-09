"use client";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Plus, FolderKanban } from "lucide-react";
import { Badge, Progress } from "@synccorehub/ui";
import Link from "next/link";
import { formatRelativeDate } from "@/lib/utils";

const STATUS_BADGE: Record<string, "default" | "success" | "warning" | "secondary" | "info"> = {
  planning: "secondary",
  active: "info" as never,
  on_hold: "warning",
  review: "warning",
  completed: "success",
  canceled: "destructive" as never,
};

export default function ProjectsPage() {
  const [status, setStatus] = useState("");
  const { data, isLoading } = trpc.projects.list.useQuery({ status: status as never || undefined });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.total ?? 0} total projects</p>
        </div>
        <button className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          New project
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {["", "planning", "active", "on_hold", "review", "completed", "canceled"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            {s === "" ? "All" : s.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading
          ? Array(6).fill(0).map((_, i) => <div key={i} className="bg-card border rounded-xl p-5 h-40 animate-pulse" />)
          : data?.data.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`}>
                <div className="bg-card border rounded-xl p-5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <FolderKanban className="h-4.5 w-4.5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{project.name}</p>
                        {project.dueDate && (
                          <p className="text-xs text-muted-foreground">Due {new Date(project.dueDate).toLocaleDateString()}</p>
                        )}
                      </div>
                    </div>
                    <Badge variant={STATUS_BADGE[project.status] ?? "secondary"} className="text-[10px] shrink-0">
                      {project.status.replace("_", " ")}
                    </Badge>
                  </div>

                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.description}</p>
                  )}

                  <div className="mt-auto space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span>{Math.round(project.progress ?? 0)}%</span>
                    </div>
                    <Progress value={project.progress ?? 0} className="h-1.5" />
                  </div>
                </div>
              </Link>
            ))}
      </div>
    </div>
  );
}
