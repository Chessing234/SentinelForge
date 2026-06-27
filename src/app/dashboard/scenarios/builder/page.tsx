import type { Metadata } from "next";
import type { ReactElement } from "react";

import { ScenarioBuilderForm } from "@/components/dashboard/scenario-builder-form";

export const metadata: Metadata = {
  title: "Scenario Builder | SentinelForge",
};

export default function ScenarioBuilderPage(): ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Scenario builder</h1>
        <p className="mt-1 text-sm text-slate-400">
          Author scenarios, attach MITRE techniques, and publish to the training catalog.
        </p>
      </div>
      <ScenarioBuilderForm />
    </div>
  );
}
