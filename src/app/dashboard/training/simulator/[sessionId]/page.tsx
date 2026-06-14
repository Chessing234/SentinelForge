import Link from "next/link";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { getSessionById } from "@/db/queries";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function SimulatorSessionPage({
  params,
}: PageProps): Promise<ReactElement> {
  const { sessionId } = await params;
  const id = Number(sessionId);
  const sessionRow = Number.isFinite(id) ? await getSessionById(id) : null;

  return (
    <div className="mx-auto max-w-lg space-y-4 py-8 text-center">
      <h1 className="text-xl font-semibold text-white">Resume session</h1>
      <p className="text-sm text-slate-400">
        {sessionRow
          ? `Session #${sessionRow.id} — ${sessionRow.scenario?.name ?? "Scenario"}. Simulator UI is not wired yet.`
          : "Session not found or unavailable."}
      </p>
      <div className="flex justify-center gap-2">
        <Button asChild variant="outline" className="border-slate-700">
          <Link href="/dashboard">Dashboard</Link>
        </Button>
        <Button asChild className="bg-emerald-600 text-white hover:bg-emerald-500">
          <Link href="/dashboard/training">Training</Link>
        </Button>
      </div>
    </div>
  );
}
