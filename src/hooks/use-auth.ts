"use client";

import type { Session } from "next-auth";
import { useSession } from "next-auth/react";

import type { Role } from "@/types";

export function useAuth(): {
  user: Session["user"] | undefined;
  role: Role | undefined;
  organizationId: number | null | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEnterpriseAdmin: boolean;
  isInstructor: boolean;
} {
  const { data: session, status } = useSession();
  const user = session?.user;
  const role = user?.role as Role | undefined;
  const organizationId = user?.organizationId;

  return {
    user,
    role,
    organizationId,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    isAdmin: role === "admin",
    isEnterpriseAdmin: role === "enterprise_admin",
    isInstructor: role === "instructor",
  };
}
