import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { ReactElement } from "react";

import { TrainingSimulatorView } from "@/components/dashboard/training-simulator-view";
import { auth } from "@/auth";
import { getConversationBySession, getSessionById, getSessionEvents } from "@/db/queries";
import type { InitialTrainingPayload } from "@/hooks/use-training-session";
import { adversaryAgent } from "@/lib/agents/adversary";
import { environmentAgent, toOverview, type EnvironmentOverview } from "@/lib/agents/environment";
import type { NetworkTopology } from "@/lib/agents/types";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sessionId } = await params;
  return {
    title: `Simulator · Session ${sessionId} | SentinelForge`,
  };
}

function isOverviewState(x: unknown): x is EnvironmentOverview {
  return (
    typeof x === "object" &&
    x !== null &&
    "hosts" in x &&
    Array.isArray((x as EnvironmentOverview).hosts)
  );
}

export default async function TrainingSessionPage({
  params,
}: PageProps): Promise<ReactElement> {
  const { sessionId: raw } = await params;
  const sessionId = Number(raw);
  if (!Number.isFinite(sessionId)) {
    notFound();
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const row = await getSessionById(sessionId);
  if (!row || row.userId !== Number(session.user.id)) {
    notFound();
  }

  if (row.status === "completed" && row.finalScore != null) {
    redirect("/dashboard/progress");
  }

  const topology = (await environmentAgent.getState(sessionId)) as NetworkTopology | null;
  let overview: EnvironmentOverview | null = topology ? toOverview(topology) : null;
  if (!overview && isOverviewState(row.environmentState)) {
    const o = row.environmentState;
    overview = {
      ...o,
      hosts: o.hosts.map((h) => ({
        ...h,
        compromised:
          "compromised" in h && typeof (h as { compromised?: boolean }).compromised === "boolean"
            ? Boolean((h as { compromised?: boolean }).compromised)
            : false,
      })),
    };
  }

  const rawEvents = await getSessionEvents(sessionId);
  const initialEvents = rawEvents.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    payload: e.payload,
    createdAt: e.createdAt.toISOString(),
  }));

  const mentorRows = await getConversationBySession(sessionId);
  const initialMentorMessages = mentorRows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    metadata: m.metadata,
    createdAt: m.createdAt.toISOString(),
  }));

  const initialAttackChain = await adversaryAgent.getStatus(sessionId, Number(session.user.id));

  const initial: InitialTrainingPayload = {
    sessionId,
    scenarioName: row.scenario?.name ?? "Training lab",
    scenarioDifficulty: row.scenario?.difficulty ?? "beginner",
    scenarioDescription: row.scenario?.description ?? "Investigate the simulated environment.",
    scenarioEstMinutes: row.scenario?.estimatedDuration ?? 30,
    status: row.status,
    finalScore: row.finalScore,
    initialEvents,
    initialOverview: overview,
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-2">
        <h1 className="text-lg font-semibold tracking-tight text-white md:text-xl">
          Training simulator
        </h1>
        <p className="text-xs text-slate-500 md:text-sm">
          Session #{sessionId} · {row.scenario?.name ?? "Lab"}
        </p>
      </div>
      <TrainingSimulatorView
        initial={initial}
        initialMentorMessages={initialMentorMessages}
        initialAttackChain={initialAttackChain}
      />
    </div>
  );
}
