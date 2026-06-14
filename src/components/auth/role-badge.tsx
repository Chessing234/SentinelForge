import { Building2, Crown, GraduationCap, User } from "lucide-react";
import type { ReactElement } from "react";

import { cn } from "@/lib/utils";
import { roleLabels } from "@/lib/rbac";
import type { Role } from "@/types";

const roleStyles: Record<
  Role,
  { className: string; Icon: typeof User }
> = {
  student: {
    className: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30",
    Icon: User,
  },
  instructor: {
    className: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
    Icon: GraduationCap,
  },
  enterprise_admin: {
    className: "bg-purple-500/15 text-purple-200 ring-1 ring-purple-500/35",
    Icon: Building2,
  },
  admin: {
    className: "bg-red-500/15 text-red-300 ring-1 ring-red-500/35",
    Icon: Crown,
  },
};

type RoleBadgeProps = {
  role: Role;
  className?: string;
};

export function RoleBadge({ role, className }: RoleBadgeProps): ReactElement {
  const { className: tone, Icon } = roleStyles[role];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {roleLabels[role]}
    </span>
  );
}
