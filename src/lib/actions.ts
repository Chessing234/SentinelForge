"use server";

import { z } from "zod";

import { auth } from "@/auth";
import { hasRole } from "@/lib/rbac";
import type { Role } from "@/types";

const roleSchema = z.enum([
  "student",
  "instructor",
  "enterprise_admin",
  "admin",
]);

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function requireAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new Error("Unauthorized");
  }
  return session.user;
}

export async function requireRole(requiredRole: Role) {
  const parsed = roleSchema.safeParse(requiredRole);
  if (!parsed.success) {
    throw new Error("Invalid role parameter");
  }
  const user = await requireAuth();
  const role = user.role as Role;
  if (!hasRole(role, parsed.data)) {
    throw new Error("Forbidden");
  }
  return user;
}
