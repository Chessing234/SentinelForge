import type { Metadata } from "next";
import type { ReactElement } from "react";

export const metadata: Metadata = {
  title: "Team | SentinelForge",
};

export default function TeamPage(): ReactElement {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-white">Team management</h1>
      <p className="text-slate-400">
        Invite learners, assign cohorts, and review seat usage. Full workflows ship in a
        later milestone.
      </p>
    </div>
  );
}
