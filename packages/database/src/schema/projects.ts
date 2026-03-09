import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants";
import { user } from "./auth";
import { customers } from "./crm";
import { portalUsers } from "./portal";

// ── Enums ─────────────────────────────────────────────────────────────────
export const projectStatusEnum = pgEnum("project_status", [
  "planning",
  "active",
  "on_hold",
  "review",
  "completed",
  "canceled",
]);

export const taskStatusEnum = pgEnum("task_status", [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "done",
  "canceled",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const milestoneStatusEnum = pgEnum("milestone_status", [
  "upcoming",
  "in_progress",
  "completed",
  "missed",
]);

// ── Projects ───────────────────────────────────────────────────────────────
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    status: projectStatusEnum("status").notNull().default("planning"),
    // Progress (0-100), can be auto-computed from tasks or manually set
    progress: doublePrecision("progress").default(0),
    manualProgress: boolean("manual_progress").default(false),
    // Dates
    startDate: timestamp("start_date", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    // Budget
    budgetCents: integer("budget_cents"),
    currency: text("currency").default("USD"),
    // Team
    ownerId: text("owner_id").references(() => user.id, { onDelete: "set null" }),
    // Portal visibility
    visibleInPortal: boolean("visible_in_portal").default(true),
    // Custom fields
    customFields: jsonb("custom_fields").$type<Record<string, unknown>>().default({}),
    tags: text("tags").array().default([]),
    // Optimistic lock
    version: integer("version").notNull().default(1),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("projects_tenant_idx").on(t.tenantId),
    index("projects_customer_idx").on(t.customerId),
    index("projects_status_idx").on(t.tenantId, t.status),
  ]
);

// ── Project Portal Access ──────────────────────────────────────────────────
// Which portal users can view which projects (in addition to customer-level access)
export const projectPortalAccess = pgTable(
  "project_portal_access",
  {
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    portalUserId: text("portal_user_id").notNull().references(() => portalUsers.id, { onDelete: "cascade" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("ppa_project_idx").on(t.projectId)]
);

// ── Milestones ─────────────────────────────────────────────────────────────
export const milestones = pgTable(
  "milestones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: milestoneStatusEnum("status").notNull().default("upcoming"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    position: doublePrecision("position").notNull().default(0),
    // Portal visibility
    visibleInPortal: boolean("visible_in_portal").default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("milestones_project_idx").on(t.projectId)]
);

// ── Tasks ──────────────────────────────────────────────────────────────────
export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    milestoneId: uuid("milestone_id").references(() => milestones.id, { onDelete: "set null" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: taskStatusEnum("status").notNull().default("todo"),
    priority: taskPriorityEnum("priority").notNull().default("medium"),
    // Fractional position for drag-and-drop ordering within status column
    position: doublePrecision("position").notNull().default(0),
    dueDate: timestamp("due_date", { withTimezone: true }),
    estimatedHours: doublePrecision("estimated_hours"),
    // Portal visibility
    visibleInPortal: boolean("visible_in_portal").default(false),
    // Optimistic lock
    version: integer("version").notNull().default(1),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("tasks_project_idx").on(t.projectId),
    index("tasks_milestone_idx").on(t.milestoneId),
    index("tasks_status_idx").on(t.tenantId, t.status),
  ]
);

// ── Task Assignments ───────────────────────────────────────────────────────
export const taskAssignments = pgTable(
  "task_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    // Assignee: either a business user or a contractor
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    contractorId: uuid("contractor_id"), // FK resolved in contractors.ts
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("task_assignments_task_idx").on(t.taskId)]
);

// ── Task Comments ──────────────────────────────────────────────────────────
export const taskComments = pgTable(
  "task_comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("task_comments_task_idx").on(t.taskId)]
);

// ── Relations ──────────────────────────────────────────────────────────────
export const projectsRelations = relations(projects, ({ one, many }) => ({
  tenant: one(tenants, { fields: [projects.tenantId], references: [tenants.id] }),
  customer: one(customers, { fields: [projects.customerId], references: [customers.id] }),
  owner: one(user, { fields: [projects.ownerId], references: [user.id] }),
  milestones: many(milestones),
  tasks: many(tasks),
  portalAccess: many(projectPortalAccess),
}));

export const milestonesRelations = relations(milestones, ({ one, many }) => ({
  project: one(projects, { fields: [milestones.projectId], references: [projects.id] }),
  tasks: many(tasks),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, { fields: [tasks.projectId], references: [projects.id] }),
  milestone: one(milestones, { fields: [tasks.milestoneId], references: [milestones.id] }),
  assignments: many(taskAssignments),
  comments: many(taskComments),
}));
