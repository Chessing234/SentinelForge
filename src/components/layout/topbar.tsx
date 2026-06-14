"use client";

import type { Session } from "next-auth";
import { Bell, ChevronRight, Menu, Moon, Sun, Laptop } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type TopbarUser = NonNullable<Session["user"]>;

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  training: "Training",
  scenarios: "Scenarios",
  progress: "My Progress",
  team: "Team Management",
  analytics: "Analytics",
  settings: "Settings",
  admin: "Admin Panel",
  builder: "Scenario Builder",
  simulator: "Simulator",
};

function labelForSegment(seg: string): string {
  if (/^\d+$/.test(seg)) {
    return "Session";
  }
  if (seg === "new") {
    return "New session";
  }
  return LABELS[seg] ?? seg.replace(/-/g, " ");
}

function breadcrumbFromPath(pathname: string): { href: string; label: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  const items: { href: string; label: string }[] = [];
  let acc = "";
  for (const seg of segments) {
    acc += `/${seg}`;
    items.push({ href: acc, label: labelForSegment(seg) });
  }
  return items;
}

function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

type DashboardTopbarProps = {
  user: TopbarUser;
  onMenuClick: () => void;
  notificationCount?: number;
};

export function DashboardTopbar({
  user,
  onMenuClick,
  notificationCount = 0,
}: DashboardTopbarProps): ReactElement {
  const pathname = usePathname();
  const crumbs = breadcrumbFromPath(pathname);
  const { theme, setTheme } = useTheme();

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b border-slate-800 bg-slate-950/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-slate-950/80 md:px-6",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-slate-200 md:hidden"
        onClick={onMenuClick}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <nav className="flex min-w-0 flex-1 items-center gap-1 text-sm text-slate-400">
        {crumbs.map((c, i) => (
          <span key={c.href} className="flex min-w-0 items-center gap-1">
            {i > 0 ? <ChevronRight className="h-4 w-4 shrink-0 text-slate-600" /> : null}
            {i === crumbs.length - 1 ? (
              <span className="truncate font-medium text-white">{c.label}</span>
            ) : (
              <Link
                href={c.href}
                className="truncate hover:text-emerald-400"
              >
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="relative text-slate-300 hover:text-white"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {notificationCount > 0 ? (
            <Badge className="absolute -right-0.5 -top-0.5 h-5 min-w-5 rounded-full border-0 bg-emerald-600 px-1 text-[10px] text-white">
              {notificationCount > 9 ? "9+" : notificationCount}
            </Badge>
          ) : null}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="relative text-slate-300 hover:text-white"
              aria-label="Theme"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute inset-0 m-auto h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="border-slate-800 bg-slate-900 text-slate-100">
            <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light" className="gap-2">
                <Sun className="h-4 w-4" />
                Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark" className="gap-2">
                <Moon className="h-4 w-4" />
                Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system" className="gap-2">
                <Laptop className="h-4 w-4" />
                System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="relative h-9 w-9 rounded-full p-0"
              aria-label="User menu"
            >
              <Avatar className="h-9 w-9 border border-slate-700">
                <AvatarImage src={user.image ?? undefined} alt="" />
                <AvatarFallback className="bg-slate-800 text-xs text-slate-200">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 border-slate-800 bg-slate-900 text-slate-100">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-white">{user.name}</p>
              <p className="truncate text-xs text-slate-400">{user.email}</p>
            </div>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem asChild className="focus:bg-slate-800 focus:text-white">
              <Link href="/dashboard/settings">Profile</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild className="focus:bg-slate-800 focus:text-white">
              <Link href="/dashboard/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-800" />
            <DropdownMenuItem
              className="focus:bg-slate-800 focus:text-red-300"
              onClick={() => void signOut({ callbackUrl: "/login" })}
            >
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
