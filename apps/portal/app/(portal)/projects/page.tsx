import { headers } from "next/headers";
import { db } from "@synccorehub/database/client";
import { projects, portalUsers, projectPortalAccess, customers, milestones } from "@synccorehub/database/schema";
import { and, eq, isNull, inArray } from "drizzle-orm";
import { Progress, Badge } from "@synccorehub/ui";
import Link from "next/link";
import { FolderKanban } from "lucide-react";

export default async function PortalProjectsPage() {
  const headersList = await headers();
  const portalUserId = headersList.get("x-portal-user-id");
  const tenantId = headersList.get("x-tenant-id");

  if (!portalUserId || !tenantId) return null;

  // Get portal user's customer link
  const [portalUser] = await db.select().from(portalUsers).where(eq(portalUsers.id, portalUserId)).limit(1);

  // Get projects:
  // 1. All projects linked to the portal user's customer
  // 2. Projects explicitly granted via projectPortalAccess
  const grantedAccess = await db.select({ projectId: projectPortalAccess.projectId }).from(projectPortalAccess).where(eq(projectPortalAccess.portalUserId, portalUserId));
  const grantedProjectIds = grantedAccess.map((r) => r.projectId);

  const conditions = [
    eq(projects.tenantId, tenantId),
    eq(projects.visibleInPortal, true),
    isNull(projects.deletedAt),
  ];

  const customerCondition = portalUser?.customerId
    ? eq(projects.customerId, portalUser.customerId)
    : undefined;

  let allProjects;
  if (grantedProjectIds.length > 0 && customerCondition) {
    allProjects = await db.select().from(projects)
      .where(and(...conditions))
      // Note: Drizzle doesn't have OR shorthand — using raw SQL for OR
      .where(and(eq(projects.tenantId, tenantId), eq(projects.visibleInPortal, true)));
  } else {
    allProjects = await db.select().from(projects)
      .where(and(...conditions, ...(customerCondition ? [customerCondition] : [])));
  }

  const STATUS_BADGE: Record<string, "default" | "success" | "warning" | "secondary"> = {
    planning: "secondary", active: "default", on_hold: "warning", review: "warning", completed: "success", canceled: "secondary",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Projects</h1>
        <p className="text-muted-foreground text-sm mt-1">Track the progress of your ongoing and completed projects</p>
      </div>

      {allProjects.length === 0 ? (
        <div className="text-center py-16">
          <FolderKanban className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold">No projects yet</h2>
          <p className="text-muted-foreground text-sm mt-1">Projects will appear here once your service provider starts work</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {allProjects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <div className="bg-card border rounded-xl p-5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold">{project.name}</h3>
                  <Badge variant={STATUS_BADGE[project.status] ?? "secondary"} className="text-xs capitalize ml-2 shrink-0">
                    {project.status.replace("_", " ")}
                  </Badge>
                </div>
                {project.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{project.description}</p>
                )}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span>{Math.round(project.progress ?? 0)}%</span>
                  </div>
                  <Progress value={project.progress ?? 0} className="h-2" />
                </div>
                {project.dueDate && (
                  <p className="text-xs text-muted-foreground mt-3">
                    Due {new Date(project.dueDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
