import type { Role } from "@/types";

const ENTERPRISE_NAV_ROLES: Role[] = [
  "instructor",
  "admin",
  "enterprise_admin",
];

export function canAccessEnterpriseNav(role: Role): boolean {
  return ENTERPRISE_NAV_ROLES.includes(role);
}

export function canAccessAdminNav(role: Role): boolean {
  return role === "admin";
}

export function canAccessHiringPortal(role: Role): boolean {
  return role === "enterprise_admin" || role === "admin";
}
