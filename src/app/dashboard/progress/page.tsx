import { format } from "date-fns";
import type { Metadata } from "next";
import type { ReactElement } from "react";

import { DifficultyBadge } from "@/components/dashboard/difficulty-badge";
import { ScoreHistoryChart } from "@/components/dashboard/score-history-chart";
import { CertificationBadgeList } from "@/components/analytics/certification-badge";
import { ScoreCard } from "@/components/analytics/score-card";
import { SkillRadar } from "@/components/analytics/skill-radar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  getCompletedScenarioScores,
  getSkillMatrixForUser,
  getUserCategoryRadarScores,
  getUserScoreHistory,
} from "@/db/dashboard-queries";
import { listUserCertifications } from "@/db/queries";
import { CERTIFICATIONS } from "@/lib/agents/evaluator/certification";
import { cn } from "@/lib/utils";
import type { Difficulty } from "@/types";

export const metadata: Metadata = {
  title: "My Progress | SentinelForge",
};

function scoreTone(score: number | undefined): string {
  if (score === undefined) return "text-slate-600";
  if (score < 60) return "text-red-400 font-semibold";
  if (score < 80) return "text-amber-300 font-medium";
  return "text-emerald-400 font-medium";
}

export default async function ProgressPage(): Promise<ReactElement> {
  const session = await auth();
  if (!session?.user?.id) {
    return <p className="text-slate-400">Unauthorized</p>;
  }
  const userId = Number(session.user.id);

  const [matrix, history, completed, radar, earnedCerts] = await Promise.all([
    getSkillMatrixForUser(userId),
    getUserScoreHistory(userId, 24),
    getCompletedScenarioScores(userId),
    getUserCategoryRadarScores(userId),
    listUserCertifications(userId),
  ]);

  const lastScore = history.length ? history[history.length - 1]!.score : null;

  const categories = [...new Set(matrix.map((m) => m.category))].sort();
  const skills = [...new Set(matrix.map((m) => m.skill))].sort();
  const cell = new Map(
    matrix.map((m) => [`${m.category}|${m.skill}`, m.score] as const),
  );

  const weak = matrix.filter((m) => m.score < 60);

  const certRows = CERTIFICATIONS.map((cert) => {
    const row = earnedCerts.find((e) => e.certificationId === cert.id);
    return {
      cert,
      earned: Boolean(row),
      earnedAt: row?.earnedAt ? new Date(row.earnedAt).toISOString() : undefined,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">My progress</h1>
        <p className="mt-1 text-sm text-slate-400">
          Skill matrix, score history, and completed scenarios.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <ScoreCard score={lastScore ?? 0} />
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-lg text-white">Category radar</CardTitle>
            <p className="text-sm text-slate-400">Six scenario categories vs recommended baseline.</p>
            {lastScore === null ? (
              <p className="text-xs text-slate-500">Complete a scored session to refresh your composite ring.</p>
            ) : null}
          </CardHeader>
          <CardContent>
            <SkillRadar data={radar} />
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-lg text-white">Certifications</CardTitle>
          <p className="text-sm text-slate-400">Progress toward SentinelForge credentials.</p>
        </CardHeader>
        <CardContent>
          <CertificationBadgeList rows={certRows} />
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-lg text-white">Skill matrix</CardTitle>
          <p className="text-sm text-slate-400">
            Rows are categories; columns are assessed skills (0–100).
          </p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {matrix.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No skill assessments yet. Complete scenarios to populate your matrix.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="sticky left-0 z-10 min-w-[140px] bg-slate-900 text-slate-400">
                    Category
                  </TableHead>
                  {skills.map((sk) => (
                    <TableHead key={sk} className="min-w-[120px] text-slate-400">
                      {sk}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((cat) => (
                  <TableRow key={cat} className="border-slate-800">
                    <TableCell className="sticky left-0 z-10 bg-slate-900 font-medium capitalize text-slate-200">
                      {cat.replace(/_/g, " ")}
                    </TableCell>
                    {skills.map((sk) => {
                      const v = cell.get(`${cat}|${sk}`);
                      return (
                        <TableCell key={sk} className={cn("tabular-nums", scoreTone(v))}>
                          {v === undefined ? "—" : v}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-lg text-white">Score history</CardTitle>
        </CardHeader>
        <CardContent>
          <ScoreHistoryChart data={history} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-lg text-white">Completed scenarios</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {completed.length === 0 ? (
              <p className="text-sm text-slate-500">No completed scenarios with scores yet.</p>
            ) : (
              completed.map((c) => (
                <div
                  key={c.sessionId}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-slate-100">{c.scenarioName}</p>
                    <p className="text-xs text-slate-500">
                      {c.completedAt
                        ? format(new Date(c.completedAt), "MMM d, yyyy")
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <DifficultyBadge difficulty={c.difficulty as Difficulty} />
                    <span className="text-sm font-semibold text-emerald-400">
                      {c.finalScore}
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-lg text-white">Weak areas</CardTitle>
            <p className="text-sm text-slate-400">Skills assessed below 60.</p>
          </CardHeader>
          <CardContent>
            {weak.length === 0 ? (
              <p className="text-sm text-slate-500">
                No weak skills detected — keep training to maintain momentum.
              </p>
            ) : (
              <ul className="space-y-2">
                {weak.map((w) => (
                  <li
                    key={`${w.category}-${w.skill}`}
                    className="flex justify-between rounded-md border border-red-500/20 bg-red-950/20 px-3 py-2 text-sm"
                  >
                    <span className="text-slate-200">
                      <span className="capitalize text-slate-400">
                        {w.category.replace(/_/g, " ")}
                      </span>{" "}
                      · {w.skill}
                    </span>
                    <span className="font-mono text-red-300">{w.score}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
