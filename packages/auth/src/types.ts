export type OrgRole = "owner" | "admin" | "manager" | "member" | "viewer";

export const ORG_ROLE_WEIGHTS: Record<OrgRole, number> = {
  owner: 100,
  admin: 80,
  manager: 60,
  member: 40,
  viewer: 20,
};

export function hasMinRole(userRole: OrgRole, minRole: OrgRole): boolean {
  return ORG_ROLE_WEIGHTS[userRole] >= ORG_ROLE_WEIGHTS[minRole];
}

export type TenantContext = {
  tenantId: string;
  organizationId: string;
  userId: string;
  role: OrgRole;
};

export type PortalUserContext = {
  portalUserId: string;
  tenantId: string;
  customerId?: string;
};
