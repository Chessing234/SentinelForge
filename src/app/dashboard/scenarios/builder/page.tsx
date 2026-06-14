import type { Metadata } from "next";
import type { ReactElement } from "react";

export const metadata: Metadata = {
  title: "Scenario Builder | SentinelForge",
};

export default function ScenarioBuilderPage(): ReactElement {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-white">Scenario builder</h1>
      <p className="text-slate-400">
        Author scenarios, attach MITRE techniques, and publish to your catalog. Editor
        coming soon.
      </p>
    </div>
  );
}
