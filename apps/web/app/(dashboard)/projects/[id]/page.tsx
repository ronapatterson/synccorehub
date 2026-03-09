"use client";
import { trpc } from "@/lib/trpc";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, Progress } from "@synccorehub/ui";
import {
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  ArrowLeft,
  Plus,
  MoreHorizontal,
} from "lucide-react";
import { toast } from "sonner";

const MILESTONE_ICONS: Record<string, React.ReactNode> = {
  upcoming: <Circle className="h-4 w-4 text-muted-foreground" />,
  in_progress: <Clock className="h-4 w-4 text-blue-500" />,
  completed: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
  missed: <Circle className="h-4 w-4 text-red-500" />,
};

const TASK_STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
};

const TASK_PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-amber-500",
  high: "text-orange-500",
  urgent: "text-red-500",
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [showNewTask, setShowNewTask] = useState(false);
  const [activeView, setActiveView] = useState<"board" | "list">("list");

  const { data: project, isLoading, refetch } = trpc.projects.byId.useQuery({ id });

  const updateTaskStatus = trpc.projects.updateTaskStatus.useMutation({
    onSuccess: () => { refetch(); toast.success("Task updated"); },
  });

  const createTask = trpc.projects.createTask.useMutation({
    onSuccess: () => {
      setNewTaskTitle("");
      setShowNewTask(false);
      refetch();
      toast.success("Task created");
    },
  });

  const completeMilestone = trpc.projects.completeMilestone.useMutation({
    onSuccess: () => { refetch(); toast.success("Milestone completed"); },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-6 bg-muted rounded w-48" />
        <div className="h-32 bg-muted rounded-xl" />
        <div className="h-60 bg-muted rounded-xl" />
      </div>
    );
  }

  if (!project) {
    return <div className="text-center py-20 text-muted-foreground">Project not found.</div>;
  }

  const tasksByStatus = (project.tasks ?? []).reduce(
    (acc, task) => {
      if (!acc[task.status]) acc[task.status] = [];
      acc[task.status].push(task);
      return acc;
    },
    {} as Record<string, typeof project.tasks>,
  );

  const boardColumns = ["backlog", "todo", "in_progress", "in_review", "done"];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button onClick={() => router.back()} className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Projects
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-foreground">{project.name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          {project.description && (
            <p className="text-muted-foreground mt-1 text-sm">{project.description}</p>
          )}
        </div>
        <Badge className="capitalize shrink-0">{project.status.replace("_", " ")}</Badge>
      </div>

      {/* Progress */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Overall Progress</span>
          <span className="font-semibold">{Math.round(project.progress ?? 0)}%</span>
        </div>
        <Progress value={project.progress ?? 0} className="h-2.5" />
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          {project.startDate && (
            <span>Started {new Date(project.startDate).toLocaleDateString()}</span>
          )}
          {project.dueDate && (
            <span>Due {new Date(project.dueDate).toLocaleDateString()}</span>
          )}
          <span>
            {(project.tasks ?? []).filter((t) => t.status === "done").length} /{" "}
            {(project.tasks ?? []).length} tasks done
          </span>
        </div>
      </div>

      {/* Milestones */}
      {(project.milestones ?? []).length > 0 && (
        <div>
          <h2 className="font-semibold text-lg mb-3">Milestones</h2>
          <div className="space-y-2">
            {(project.milestones ?? []).map((milestone) => (
              <div
                key={milestone.id}
                className="bg-card border rounded-xl p-4 flex items-center gap-4"
              >
                {MILESTONE_ICONS[milestone.status]}
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium text-sm ${milestone.status === "completed" ? "line-through text-muted-foreground" : ""}`}
                  >
                    {milestone.name}
                  </p>
                  {milestone.dueDate && (
                    <p className="text-xs text-muted-foreground">
                      Due {new Date(milestone.dueDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      milestone.status === "completed"
                        ? "success"
                        : milestone.status === "missed"
                          ? "destructive"
                          : "secondary"
                    }
                    className="text-xs capitalize"
                  >
                    {milestone.status.replace("_", " ")}
                  </Badge>
                  {milestone.status !== "completed" && (
                    <button
                      onClick={() => completeMilestone.mutate({ milestoneId: milestone.id })}
                      className="text-xs text-emerald-600 hover:underline"
                    >
                      Mark done
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tasks */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-lg">Tasks</h2>
          <div className="flex items-center gap-2">
            <div className="flex border rounded-lg overflow-hidden text-sm">
              {(["list", "board"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setActiveView(v)}
                  className={`px-3 py-1.5 capitalize transition-colors ${activeView === v ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                >
                  {v}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowNewTask(true)}
              className="flex items-center gap-1.5 text-sm font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Add task
            </button>
          </div>
        </div>

        {/* New task form */}
        {showNewTask && (
          <div className="mb-4 p-4 bg-muted/40 rounded-xl flex gap-2">
            <input
              autoFocus
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTaskTitle.trim()) {
                  createTask.mutate({ projectId: id, title: newTaskTitle });
                }
                if (e.key === "Escape") {
                  setShowNewTask(false);
                  setNewTaskTitle("");
                }
              }}
              placeholder="Task title… (Enter to save, Esc to cancel)"
              className="flex-1 border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              onClick={() => createTask.mutate({ projectId: id, title: newTaskTitle })}
              disabled={!newTaskTitle.trim() || createTask.isPending}
              className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-60"
            >
              Add
            </button>
          </div>
        )}

        {activeView === "list" ? (
          <div className="bg-card border rounded-xl divide-y">
            {(project.tasks ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                No tasks yet. Add the first one.
              </p>
            ) : (
              (project.tasks ?? []).map((task) => (
                <div key={task.id} className="flex items-center gap-4 px-5 py-3.5">
                  <button
                    onClick={() =>
                      updateTaskStatus.mutate({
                        taskId: task.id,
                        status: task.status === "done" ? "todo" : "done",
                      })
                    }
                  >
                    {task.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  <p
                    className={`flex-1 text-sm ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}
                  >
                    {task.title}
                  </p>
                  {task.priority && (
                    <span className={`text-xs font-medium ${TASK_PRIORITY_COLORS[task.priority] ?? ""}`}>
                      {task.priority}
                    </span>
                  )}
                  <Badge variant="secondary" className="text-xs capitalize">
                    {TASK_STATUS_LABELS[task.status] ?? task.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Board view */
          <div className="flex gap-4 overflow-x-auto pb-4">
            {boardColumns.map((col) => {
              const colTasks = tasksByStatus[col] ?? [];
              return (
                <div key={col} className="min-w-64 flex-shrink-0">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {TASK_STATUS_LABELS[col] ?? col}
                    </span>
                    <span className="text-xs text-muted-foreground">{colTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {colTasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-card border rounded-lg p-3 text-sm shadow-sm"
                      >
                        <p className="font-medium">{task.title}</p>
                        {task.priority && (
                          <p className={`text-xs mt-1 ${TASK_PRIORITY_COLORS[task.priority] ?? ""}`}>
                            {task.priority}
                          </p>
                        )}
                        <div className="flex justify-end mt-2">
                          <button className="text-muted-foreground hover:text-foreground">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {colTasks.length === 0 && (
                      <div className="border border-dashed rounded-lg p-3 text-xs text-muted-foreground text-center">
                        Empty
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
