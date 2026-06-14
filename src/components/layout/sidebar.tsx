"use client";

import type { Session } from "next-auth";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  Building2,
  CreditCard,
  LayoutDashboard,
  LogOut,
  PenTool,
  Settings,
  Shield,
  Target,
  TrendingUp,
  UserCircle,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import { signOut } from "next-auth/react";

import { RoleBadge } from "@/components/auth/role-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { canAccessAdminNav, canAccessEnterpriseNav, canAccessHiringPortal } from "@/lib/role-access";
import type { Role } from "@/types";

export type SidebarUser = NonNullable<Session["user"]>;

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const mainNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/training", label: "Training", icon: Target },
  { href: "/dashboard/scenarios", label: "Scenarios", icon: BookOpen },
  { href: "/dashboard/progress", label: "My Progress", icon: TrendingUp },
  { href: "/dashboard/jobs", label: "Job Opportunities", icon: Briefcase },
  { href: "/dashboard/profile", label: "Profile", icon: UserCircle },
];

const enterpriseNav: NavItem[] = [
  { href: "/dashboard/team", label: "Team Management", icon: Users },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const adminNav: NavItem[] = [
  { href: "/dashboard/admin", label: "Admin Panel", icon: Shield },
  {
    href: "/dashboard/scenarios/builder",
    label: "Scenario Builder",
    icon: PenTool,
  },
];

function isActivePath(pathname: string, href: string): boolean {
  if (href === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

type SidebarProps = {
  user: SidebarUser;
  open: boolean;
  onNavigate?: () => void;
};

export function Sidebar({ user, open, onNavigate }: SidebarProps): ReactElement {
  const pathname = usePathname();
  const role = user.role as Role;
  const showEnterprise = canAccessEnterpriseNav(role);
  const showAdmin = canAccessAdminNav(role);
  const showHiring = canAccessHiringPortal(role);

  const enterpriseLinks = enterpriseNav.filter(
    (item) => role === "enterprise_admin" || item.href !== "/dashboard/billing",
  );

  const linkClass = (href: string) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ease-out",
      isActivePath(pathname, href)
        ? "bg-emerald-600 text-white"
        : "text-slate-300 hover:bg-slate-800 hover:text-white",
    );

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-[280px] flex-col border-r border-slate-800 bg-slate-950 transition-transform duration-200 ease-out",
        "md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}
      aria-hidden={!open}
    >
      <div className="flex h-16 shrink-0 items-center border-b border-slate-800 px-4">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-2.5 text-white transition-opacity hover:opacity-90"
        >
          <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600/20 ring-1 ring-emerald-500/40">
            <Shield className="h-5 w-5 text-emerald-400" aria-hidden />
            <Zap
              className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 text-amber-300"
              aria-hidden
            />
          </span>
          <span className="text-lg font-semibold tracking-tight">SentinelForge</span>
        </Link>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Main
          </p>
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={linkClass(item.href)}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden />
              {item.label}
            </Link>
          ))}

          {showHiring ? (
            <>
              <p className="mt-6 px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Hiring
              </p>
              <Link
                href="/dashboard/hiring"
                onClick={onNavigate}
                className={linkClass("/dashboard/hiring")}
              >
                <Building2 className="h-4 w-4 shrink-0" aria-hidden />
                Hiring portal
              </Link>
            </>
          ) : null}

          {showEnterprise ? (
            <>
              <p className="mt-6 px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Enterprise
              </p>
              {enterpriseLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={linkClass(item.href)}
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              ))}
            </>
          ) : null}

          {showAdmin ? (
            <>
              <p className="mt-6 px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Admin
              </p>
              {adminNav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={linkClass(item.href)}
                >
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              ))}
            </>
          ) : null}
        </nav>
      </ScrollArea>

      <div className="shrink-0 border-t border-slate-800 p-3">
        <div className="flex items-center gap-3 rounded-lg bg-slate-900/80 p-3">
          <Avatar className="h-10 w-10 border border-slate-700">
            <AvatarImage src={user.image ?? undefined} alt="" />
            <AvatarFallback className="bg-slate-800 text-slate-200">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-slate-400">{user.email}</p>
            <div className="mt-1.5">
              <RoleBadge role={role} className="text-[10px]" />
            </div>
          </div>
        </div>
        <Separator className="my-3 bg-slate-800" />
        <Button
          type="button"
          variant="outline"
          className="w-full border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white"
          onClick={() => void signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Logout
        </Button>
      </div>
    </aside>
  );
}
