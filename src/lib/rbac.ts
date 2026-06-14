import type { Role } from "@/types";

export const ROLES: Role[] = [
  "student",
  "instructor",
  "enterprise_admin",
  "admin",
];

const ROLE_RANK: Record<Role, number> = {
  student: 0,
  instructor: 1,
  enterprise_admin: 2,
  admin: 3,
};

export function hasRole(userRole: Role | undefined, requiredRole: Role): boolean {
  if (!userRole) {
    return false;
  }
  return ROLE_RANK[userRole] >= ROLE_RANK[requiredRole];
}

export function canManageScenarios(role: Role | undefined): boolean {
  return hasRole(role, "instructor");
}

export function canManageOrganization(role: Role | undefined): boolean {
  return hasRole(role, "enterprise_admin");
}

export function canAccessAdmin(role: Role | undefined): boolean {
  return role === "admin";
}

export function canStartTraining(_role: Role | undefined): boolean {
  return _role !== undefined;
}

export const roleLabels: Record<Role, string> = {
  student: "Student",
  instructor: "Instructor",
  enterprise_admin: "Enterprise Admin",
  admin: "Administrator",
};
