import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";

import { DifficultyBadge } from "@/components/dashboard/difficulty-badge";
import { ActiveSessionCard } from "@/components/dashboard/active-session-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/auth";
import {
  getActiveTrainingSession,
  getRecommendedScenarios,
  getTotalActiveScenarioCount,
  getUserCompletedScenarioCount,
} from "@/db/dashboard-queries";
import type { Difficulty } from "@/types";

export const metadata: Metadata = {
  title: "Training | SentinelForge",
};

function activeProgress(session: {
  finalScore: number | null;
  startedAt: Date | null;
  scenario: { estimatedDuration: number } | null;
}): number {
  if (session.finalScore != null) {
    return Math.min(100, session.finalScore);
  }
  if (!session.startedAt || !session.scenario) return 15;
  const elapsedMin =
    (Date.now() - new Date(session.startedAt).getTime()) / 60000;
  const target = Math.max(session.scenario.estimatedDuration, 1);
  return Math.min(95, Math.round((elapsedMin / target) * 100));
}

export default async function TrainingPage(): Promise<ReactElement> {
  const session = await auth();
  if (!session?.user?.id) {
    return <p className="text-slate-400">Unauthorized</p>;
  }
  const userId = Number(session.user.id);

  const [recommended, active, totalScenarios, completed] = await Promise.all([
    getRecommendedScenarios(userId, 3),
    getActiveTrainingSession(userId),
    getTotalActiveScenarioCount(),
    getUserCompletedScenarioCount(userId),
  ]);

  const completionRate =
    totalScenarios === 0 ? 0 : Math.round((completed / totalScenarios) * 100);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Training</h1>
        <p className="mt-2 text-lg text-slate-300">
          Choose a scenario to begin your training.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-400">
              Scenarios available
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-white">{totalScenarios}</CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-400">
              Your completion rate
            </CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-emerald-400">
            {completionRate}%
          </CardContent>
        </Card>
      </div>

      {active ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Continue where you left off</h2>
          <ActiveSessionCard
            sessionId={active.id}
            scenarioName={active.scenario?.name ?? "Training"}
            startedAt={active.startedAt}
            progressPct={activeProgress({
              finalScore: active.finalScore,
              startedAt: active.startedAt,
              scenario: active.scenario,
            })}
          />
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Recommended for you</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {recommended.map((s) => (
            <Card key={s.id} className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="text-base text-white">{s.name}</CardTitle>
                <DifficultyBadge difficulty={s.difficulty as Difficulty} />
              </CardHeader>
              <CardContent>
                <p className="line-clamp-3 text-sm text-slate-400">{s.description}</p>
                <Button
                  asChild
                  className="mt-4 w-full bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  <Link href={`/dashboard/training/simulator/new?scenarioId=${s.id}`}>
                    Start Training
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Button variant="outline" asChild className="border-slate-700 text-slate-200">
        <Link href="/dashboard/scenarios">Browse all scenarios</Link>
      </Button>
    </div>
  );
}
