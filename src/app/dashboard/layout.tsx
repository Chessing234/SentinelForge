import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactElement, ReactNode } from "react";

import { auth } from "@/auth";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard | SentinelForge",
};

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>): Promise<ReactElement> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <DashboardShell user={session.user}>{children}</DashboardShell>;
}
