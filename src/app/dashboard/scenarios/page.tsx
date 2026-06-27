import Link from "next/link";
import type { Metadata } from "next";
import type { ReactElement } from "react";

import { ScenarioBrowser } from "@/components/dashboard/scenario-browser";
import { auth } from "@/auth";
import { getActiveScenarios } from "@/db/queries";

export const metadata: Metadata = {
  title: "Scenarios | SentinelForge",
};

export default async function ScenariosPage(): Promise<ReactElement> {
  const [scenarios, session] = await Promise.all([getActiveScenarios(), auth()]);
  const isAdmin = session?.user?.role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Scenario browser
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Filter and launch hands-on labs aligned to MITRE techniques.
          </p>
        </div>
        {isAdmin ? (
          <Link
            href="/dashboard/scenarios/builder"
            className="rounded-md border border-emerald-600/50 bg-emerald-950/30 px-3 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-900/40"
          >
            Create scenario
          </Link>
        ) : null}
      </div>
      <ScenarioBrowser scenarios={scenarios} />
    </div>
  );
}
