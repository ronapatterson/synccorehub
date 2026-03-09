import { headers } from "next/headers";
import { db } from "@synccorehub/database/client";
import { projects, milestones, tasks } from "@synccorehub/database/schema";
import { and, asc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Progress, Badge } from "@synccorehub/ui";
import { CheckCircle2, Clock, Circle, ChevronRight } from "lucide-react";

const MILESTONE_ICONS = {
  upcoming: <Circle className="h-4 w-4 text-muted-foreground" />,
  in_progress: <Clock className="h-4 w-4 text-blue-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  missed: <Circle className="h-4 w-4 text-red-500" />,
};

export default async function PortalProjectDetailPage({ params }: { params: { id: string } }) {
  const headersList = await headers();
  const tenantId = headersList.get("x-tenant-id");

  const [project] = await db.select().from(projects)
    .where(and(eq(projects.id, params.id), eq(projects.visibleInPortal, true), isNull(projects.deletedAt)))
    .limit(1);

  if (!project || project.tenantId !== tenantId) notFound();

  const [projectMilestones, portalTasks] = await Promise.all([
    db.select().from(milestones).where(eq(milestones.projectId, params.id)).orderBy(asc(milestones.position)),
    db.select().from(tasks).where(and(eq(tasks.projectId, params.id), eq(tasks.visibleInPortal, true), isNull(tasks.deletedAt))).orderBy(asc(tasks.position)),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <a href="/projects" className="hover:text-foreground">Projects</a>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground">{project.name}</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            {project.description && <p className="text-muted-foreground mt-1">{project.description}</p>}
          </div>
          <Badge className="capitalize shrink-0">{project.status.replace("_", " ")}</Badge>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Overall Progress</span>
          <span className="font-semibold">{Math.round(project.progress ?? 0)}%</span>
        </div>
        <Progress value={project.progress ?? 0} className="h-3" />
        {project.dueDate && (
          <p className="text-xs text-muted-foreground mt-2">Due {new Date(project.dueDate).toLocaleDateString()}</p>
        )}
      </div>

      {/* Milestones */}
      {projectMilestones.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-4">Milestones</h2>
          <div className="space-y-3">
            {projectMilestones.filter((m) => m.visibleInPortal).map((milestone) => (
              <div key={milestone.id} className="bg-card border rounded-xl p-4 flex items-center gap-4">
                {MILESTONE_ICONS[milestone.status]}
                <div className="flex-1">
                  <p className={`font-medium text-sm ${milestone.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                    {milestone.name}
                  </p>
                  {milestone.dueDate && (
                    <p className="text-xs text-muted-foreground">Due {new Date(milestone.dueDate).toLocaleDateString()}</p>
                  )}
                </div>
                <Badge
                  variant={milestone.status === "completed" ? "success" : milestone.status === "missed" ? "destructive" : "secondary"}
                  className="text-xs capitalize"
                >
                  {milestone.status.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visible tasks */}
      {portalTasks.length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-4">Tasks</h2>
          <div className="bg-card border rounded-xl divide-y">
            {portalTasks.map((task) => (
              <div key={task.id} className="flex items-center gap-4 px-5 py-3.5">
                {task.status === "done" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <p className={`flex-1 text-sm ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                  {task.title}
                </p>
                <Badge variant="secondary" className="text-xs capitalize">{task.status.replace("_", " ")}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
