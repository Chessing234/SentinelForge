import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db/index";
import { skillAssessments } from "@/db/schema";
import type { sessionEvents, scenarios, trainingSessions } from "@/db/schema";
import { loadState } from "@/lib/agents/environment/session-store";
import { scoreDetection } from "@/lib/agents/adversary/scoring";

export type ScoreGrade = "F" | "D" | "C" | "B" | "A" | "S";

export interface ScoreBreakdown {
  detectionScore: number;
  analysisScore: number;
  responseScore: number;
  speedScore: number;
  totalScore: number;
  grade: ScoreGrade;
  timeSpent: number;
  hintsUsed: number;
}

const GOOD_TOOLS = ["nmap", "netstat", "ps", "grep", "ssh", "find", "ls", "cat", "strings"];

function gradeFromTotal(n: number): ScoreGrade {
  if (n >= 95) return "S";
  if (n >= 85) return "A";
  if (n >= 75) return "B";
  if (n >= 65) return "C";
  if (n >= 50) return "D";
  return "F";
}

function countHints(events: (typeof sessionEvents.$inferSelect)[]): number {
  return events.filter((e) => e.eventType === "hint_given").length;
}

function detectionPoints(sessionId: number): { pts: number; max: number } {
  const payload = loadState(sessionId);
  const chain = payload?.attackChain;
  const history = payload?.detectionHistory ?? [];
  if (!chain || chain.steps.length === 0) {
    const high = history.filter((h) => h.scorePercent >= 60).length;
    return { pts: Math.min(40, high * 13), max: 40 };
  }

  const total = chain.steps.length;
  const completed = chain.steps.filter((s) => s.status === "completed");
  let sum = 0;
  for (const step of completed) {
    let best = 0;
    for (const h of history) {
      const sc = scoreDetection(chain, h.submitted);
      if (sc.matchedTechniqueId === step.technique.id && sc.scorePercent >= 100) best = Math.max(best, 1);
      else if (sc.matchedTactic === step.technique.tactic && sc.scorePercent >= 60)
        best = Math.max(best, 0.6);
      else if (sc.scorePercent >= 40) best = Math.max(best, 0.35);
    }
    sum += best;
  }
  const pts = Math.round((40 / total) * sum);
  return { pts: Math.min(40, pts), max: 40 };
}

function analysisPoints(events: (typeof sessionEvents.$inferSelect)[]): number {
  const used = new Set<string>();
  let wrong = 0;
  for (const e of events) {
    if (e.eventType !== "milestone_reached") continue;
    const p = e.payload as { command?: string; exitCode?: number } | null;
    const cmd = (p?.command ?? "").toLowerCase();
    if (!cmd) continue;
    if (typeof p?.exitCode === "number" && p.exitCode !== 0) wrong += 1;
    for (const t of GOOD_TOOLS) {
      if (cmd.includes(t)) used.add(t);
    }
  }
  const toolPts = Math.min(15, used.size * 5);
  const chainBonus = used.size >= 3 ? 15 : 0;
  const penalty = Math.min(10, wrong * 2);
  return Math.max(0, Math.min(30, toolPts + chainBonus - penalty));
}

function responsePoints(events: (typeof sessionEvents.$inferSelect)[]): number {
  const flags = events.filter((e) => e.eventType === "flag_correct").length;
  let pts = 0;
  if (flags >= 1) pts += 5;
  if (flags >= 2) pts += 5;
  const logPeek = events.some((e) => {
    if (e.eventType !== "milestone_reached") return false;
    const c = ((e.payload as { command?: string })?.command ?? "").toLowerCase();
    return c.includes("grep") && (c.includes("/var/log") || c.includes("auth.log"));
  });
  if (logPeek) pts += 5;
  const mentorDepth = events.filter((e) => e.eventType === "hint_requested").length;
  if (mentorDepth <= 2 && flags >= 1) pts += 5;
  return Math.min(20, pts);
}

function speedPoints(
  timeSpentSec: number,
  estimatedMinutes: number,
): number {
  const estSec = Math.max(300, estimatedMinutes * 60);
  if (timeSpentSec <= 0) return 5;
  if (timeSpentSec <= estSec) return 10;
  if (timeSpentSec <= estSec * 1.5) return 5;
  return 0;
}

export function calculateScore(
  sessionId: number,
  session: typeof trainingSessions.$inferSelect,
  scenario: typeof scenarios.$inferSelect,
  events: (typeof sessionEvents.$inferSelect)[],
): ScoreBreakdown {
  const hintsUsed = countHints(events);
  const { pts: detectionScore } = detectionPoints(sessionId);
  const analysisScore = analysisPoints(events);
  const responseScore = responsePoints(events);
  const timeSpent =
    session.timeSpent ??
    (session.startedAt && session.completedAt
      ? Math.max(
          0,
          Math.floor(
            (new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) /
              1000,
          ),
        )
      : 0);
  const speedScore = speedPoints(timeSpent, scenario.estimatedDuration);

  let raw =
    Math.min(40, detectionScore) +
    Math.min(30, analysisScore) +
    Math.min(20, responseScore) +
    Math.min(10, speedScore);
  raw = Math.max(0, raw - hintsUsed * 2);
  const totalScore = Math.min(100, Math.round(raw));
  return {
    detectionScore: Math.min(40, detectionScore),
    analysisScore: Math.min(30, analysisScore),
    responseScore: Math.min(20, responseScore),
    speedScore: Math.min(10, speedScore),
    totalScore,
    grade: gradeFromTotal(totalScore),
    timeSpent,
    hintsUsed,
  };
}

const SKILL_KEY = "lab_performance";

export async function updateSkillMatrix(
  userId: number,
  category: string,
  scoreBreakdown: ScoreBreakdown,
): Promise<void> {
  const [prev] = await db
    .select()
    .from(skillAssessments)
    .where(
      and(
        eq(skillAssessments.userId, userId),
        eq(skillAssessments.category, category),
        eq(skillAssessments.skill, SKILL_KEY),
      ),
    )
    .orderBy(desc(skillAssessments.assessedAt))
    .limit(1);

  const newScore = prev
    ? Math.round(Number(prev.score) * 0.7 + scoreBreakdown.totalScore * 0.3)
    : scoreBreakdown.totalScore;

  const countRows = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(skillAssessments)
    .where(eq(skillAssessments.userId, userId));
  const n = Number(countRows[0]?.c ?? 0);
  const confidence = Math.min(0.95, 0.45 + n * 0.03).toFixed(2);

  await db.insert(skillAssessments).values({
    userId,
    category,
    skill: SKILL_KEY,
    score: newScore,
    confidence,
  });
}
