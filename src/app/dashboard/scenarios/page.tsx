import type { Metadata } from "next";
import type { ReactElement } from "react";

import { ScenarioBrowser } from "@/components/dashboard/scenario-browser";
import { getActiveScenarios } from "@/db/queries";

export const metadata: Metadata = {
  title: "Scenarios | SentinelForge",
};

export default async function ScenariosPage(): Promise<ReactElement> {
  const scenarios = await getActiveScenarios();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Scenario browser
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Filter and launch hands-on labs aligned to MITRE techniques.
        </p>
      </div>
      <ScenarioBrowser scenarios={scenarios} />
    </div>
  );
}
