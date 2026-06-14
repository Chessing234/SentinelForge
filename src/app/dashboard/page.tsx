import { format } from "date-fns";
import {
  Award,
  Flame,
  LayoutList,
  LineChart as LineChartIcon,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";

import { ActiveSessionCard } from "@/components/dashboard/active-session-card";
import { DifficultyBadge } from "@/components/dashboard/difficulty-badge";
import { SkillRadarChart } from "@/components/dashboard/skill-radar-chart";
import { StatsCard } from "@/components/dashboard/stats-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { auth } from "@/auth";
import {
  getActiveTrainingSession,
  getRecentTrainingSessionsWithScenario,
  getSessionsCompletedTrend,
  getUserAverageCompletedScore,
  getUserCategoryRadarScores,
  getUserLeaderboardRank,
  getUserTrainingStreakDays,
} from "@/db/dashboard-queries";
import type { Difficulty } from "@/types";

function trendFromPct(pct: number): "up" | "down" | "flat" {
  if (pct > 0) return "up";
  if (pct < 0) return "down";
  return "flat";
}

function formatMinutes(sec: number | null): string {
  if (sec === null || sec === undefined) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

function statusBadge(status: string): ReactElement {
  const tone: Record<string, string> = {
    completed: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
    running: "bg-blue-500/15 text-blue-300 ring-blue-500/30",
    paused: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
    pending: "bg-slate-700 text-slate-300 ring-slate-600",
    abandoned: "bg-red-500/15 text-red-300 ring-red-500/30",
  };
  return (
    <Badge variant="outline" className={tone[status] ?? tone.pending}>
      {status}
    </Badge>
  );
}

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

export default async function DashboardPage(): Promise<ReactElement> {
  const session = await auth();
  if (!session?.user?.id) {
    return <div className="text-slate-400">Unauthorized</div>;
  }

  const userId = Number(session.user.id);
  const [
    trendData,
    streak,
    avgScore,
    rank,
    recent,
    radar,
    active,
  ] = await Promise.all([
    getSessionsCompletedTrend(userId),
    getUserTrainingStreakDays(userId),
    getUserAverageCompletedScore(userId),
    getUserLeaderboardRank(userId),
    getRecentTrainingSessionsWithScenario(userId, 5),
    getUserCategoryRadarScores(userId),
    getActiveTrainingSession(userId),
  ]);

  const trend = trendFromPct(trendData.trendPct);
  const avg = avgScore ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Overview
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Welcome back, {session.user.name?.split(" ")[0]}. Here is your training
          snapshot.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          label="Training sessions completed"
          value={trendData.totalCompleted}
          icon={LayoutList}
          trend={{
            direction: trend,
            pct: trendData.trendPct,
          }}
        />
        <StatsCard
          label="Average score"
          value={avg}
          icon={LineChartIcon}
          format="decimal"
          footer={
            <Progress
              value={avg}
              className="mt-3 h-2 bg-slate-800 [&>div]:bg-emerald-500"
            />
          }
        />
        <StatsCard
          label="Current streak"
          value={streak}
          icon={Flame}
          footer={
            <p className="mt-2 text-xs text-slate-500">
              Consecutive days with a completed session
            </p>
          }
        />
        <StatsCard
          label="Leaderboard rank"
          value={rank ?? 0}
          icon={Trophy}
          valueLabel={rank === null ? "—" : `#${rank}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="border-slate-800 bg-slate-900/50 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg text-white">Recent sessions</CardTitle>
            <Button variant="ghost" size="sm" asChild className="text-emerald-400">
              <Link href="/dashboard/scenarios">Browse scenarios</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
                <Award className="h-10 w-10 text-slate-600" />
                <p className="max-w-sm text-sm text-slate-400">
                  No training sessions yet. Start your first scenario!
                </p>
                <Button
                  asChild
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  <Link href="/dashboard/scenarios">Start training</Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border border-slate-800">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400">Scenario</TableHead>
                      <TableHead className="text-slate-400">Difficulty</TableHead>
                      <TableHead className="text-slate-400">Score</TableHead>
                      <TableHead className="text-slate-400">Time</TableHead>
                      <TableHead className="text-slate-400">Date</TableHead>
                      <TableHead className="text-slate-400">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((row) => (
                      <TableRow key={row.id} className="border-slate-800">
                        <TableCell className="font-medium text-slate-100">
                          {row.scenarioName}
                        </TableCell>
                        <TableCell>
                          <DifficultyBadge difficulty={row.difficulty as Difficulty} />
                        </TableCell>
                        <TableCell className="text-slate-300">
                          {row.score ?? "—"}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {formatMinutes(row.timeSpent)}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {format(new Date(row.date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{statusBadge(row.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          {active ? (
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
          ) : (
            <Card className="border-slate-800 bg-slate-900/50">
              <CardHeader>
                <CardTitle className="text-lg text-white">Start training</CardTitle>
                <p className="text-sm text-slate-400">
                  Pick a scenario to launch your next hands-on lab.
                </p>
              </CardHeader>
              <CardContent>
                <Button
                  asChild
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  <Link href="/dashboard/training">Start training</Link>
                </Button>
              </CardContent>
            </Card>
          )}

          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader>
              <CardTitle className="text-lg text-white">Skill radar</CardTitle>
              <p className="text-sm text-slate-400">
                Average scores by domain (0–100).
              </p>
            </CardHeader>
            <CardContent>
              <SkillRadarChart data={radar} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
