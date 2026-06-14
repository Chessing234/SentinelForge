"use client";

import type { Session } from "next-auth";
import type { ReactElement, ReactNode } from "react";
import { useState } from "react";

import { DashboardTopbar } from "@/components/layout/topbar";
import { Sidebar } from "@/components/layout/sidebar";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  user: NonNullable<Session["user"]>;
  children: ReactNode;
  notificationCount?: number;
};

export function DashboardShell({
  user,
  children,
  notificationCount = 0,
}: DashboardShellProps): ReactElement {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/60 backdrop-blur-sm transition-opacity md:hidden",
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!sidebarOpen}
        onClick={() => setSidebarOpen(false)}
      />

      <Sidebar
        user={user}
        open={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
      />

      <div className="flex min-h-screen flex-col md:pl-[280px]">
        <DashboardTopbar
          user={user}
          notificationCount={notificationCount}
          onMenuClick={() => setSidebarOpen((o) => !o)}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
