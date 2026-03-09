import { z } from "zod";

// ── Pagination ────────────────────────────────────────────────────────────
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(25),
});
export type Pagination = z.infer<typeof paginationSchema>;

export type PaginatedResult<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

// ── API Response ──────────────────────────────────────────────────────────
export type ApiSuccess<T> = { success: true; data: T };
export type ApiError = { success: false; error: string; code?: string };
export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ── Customer forms ────────────────────────────────────────────────────────
export const createCustomerSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  industry: z.string().optional(),
  companySize: z.string().optional(),
  annualRevenue: z.string().optional(),
  country: z.string().optional(),
  city: z.string().optional(),
  status: z.enum(["active", "inactive", "churned", "prospect"]).default("prospect"),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  source: z.string().optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;

// ── Lead forms ────────────────────────────────────────────────────────────
export const createLeadSchema = z.object({
  title: z.string().min(1),
  pipelineId: z.string().uuid(),
  stageId: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  value: z.number().min(0).optional(),
  currency: z.string().default("USD"),
  expectedCloseDate: z.string().datetime().optional(),
  source: z.string().optional(),
  ownerId: z.string().optional(),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

// ── Project forms ─────────────────────────────────────────────────────────
export const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  customerId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  budgetCents: z.number().min(0).optional(),
  currency: z.string().default("USD"),
  visibleInPortal: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

// ── ICP Criterion ─────────────────────────────────────────────────────────
export const icpCriterionSchema = z.object({
  field: z.string().min(1),
  fieldLabel: z.string().min(1),
  operator: z.enum(["eq", "neq", "in", "not_in", "contains", "gte", "lte", "between", "is_null", "is_not_null"]),
  value: z.unknown(),
  weight: z.number().min(0).max(100),
  pointsIfMatch: z.number().min(0),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
});
export type IcpCriterionInput = z.infer<typeof icpCriterionSchema>;

// ── Contractor forms ──────────────────────────────────────────────────────
export const createContractorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  type: z.enum(["individual", "agency"]).default("individual"),
  skills: z.array(z.string()).default([]),
  hourlyRateCents: z.number().min(0).optional(),
  currency: z.string().default("USD"),
});
export type CreateContractorInput = z.infer<typeof createContractorSchema>;

// ── Plugin config ─────────────────────────────────────────────────────────
export const pluginConfigEntrySchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  isSecret: z.boolean().default(false),
});
export type PluginConfigEntry = z.infer<typeof pluginConfigEntrySchema>;

// ── Webhook forms ─────────────────────────────────────────────────────────
export const createWebhookSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  events: z.array(z.string()).min(1),
  headers: z.record(z.string()).optional(),
});
export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

// ── Portal invitation ─────────────────────────────────────────────────────
export const invitePortalUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  customerId: z.string().uuid().optional(),
  projectIds: z.array(z.string().uuid()).default([]),
});
export type InvitePortalUserInput = z.infer<typeof invitePortalUserSchema>;
