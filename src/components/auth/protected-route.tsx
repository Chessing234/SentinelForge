"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, type ReactElement, type ReactNode } from "react";

import { useAuth } from "@/hooks/use-auth";
import { hasRole } from "@/lib/rbac";
import type { Role } from "@/types";

type ProtectedRouteProps = {
  children: ReactNode;
  requiredRole?: Role;
};

export function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps): ReactElement {
  const { isLoading, isAuthenticated, role } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!isAuthenticated) {
      void router.replace("/login");
      return;
    }
    if (requiredRole && !hasRole(role, requiredRole)) {
      void router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, requiredRole, role, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (requiredRole && !hasRole(role, requiredRole)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
