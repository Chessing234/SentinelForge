import { subDays } from "date-fns";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNotNull,
  lte,
  ne,
  sql,
} from "drizzle-orm";

import { db } from "@/db/index";
import {
  scenarioCategoryEnum,
  scenarios,
  skillAssessments,
  trainingSessions,
} from "@/db/schema";
import type { Category, Difficulty } from "@/types";

const SCENARIO_CATEGORIES = scenarioCategoryEnum.enumValues;

export type RecentSessionRow = {
  id: number;
  scenarioName: string;
  difficulty: Difficulty;
  score: number | null;
  timeSpent: number | null;
  date: Date;
  status: (typeof trainingSessions.$inferSelect)["status"];
};

export async function getRecentTrainingSessionsWithScenario(
  userId: number,
  limit = 5,
): Promise<RecentSessionRow[]> {
  const rows = await db.query.trainingSessions.findMany({
    where: eq(trainingSessions.userId, userId),
    orderBy: (s, { desc: d }) => [d(s.createdAt)],
    limit,
    with: { scenario: true },
  });

  return rows.map((r) => ({
    id: r.id,
    scenarioName: r.scenario?.name ?? "Unknown scenario",
    difficulty: r.scenario?.difficulty ?? "beginner",
    score: r.finalScore ?? null,
    timeSpent: r.timeSpent ?? null,
    date: r.createdAt,
    status: r.status,
  }));
}

export async function getActiveTrainingSession(userId: number) {
  return db.query.trainingSessions.findFirst({
    where: and(
      eq(trainingSessions.userId, userId),
      inArray(trainingSessions.status, ["running", "paused"]),
    ),
    orderBy: (s, { desc: d }) => [d(s.createdAt)],
    with: { scenario: true },
  });
}

export async function getCompletedSessionCountInRange(
  userId: number,
  from: Date,
  to: Date,
): Promise<number> {
  const [{ c }] = await db
    .select({ c: count() })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, userId),
        eq(trainingSessions.status, "completed"),
        isNotNull(trainingSessions.completedAt),
        gte(trainingSessions.completedAt, from),
        lte(trainingSessions.completedAt, to),
      ),
    );
  return Number(c);
}

export async function getSessionsCompletedTrend(userId: number): Promise<{
  totalCompleted: number;
  trendPct: number;
}> {
  const now = new Date();
  const last30Start = subDays(now, 30);
  const prev60Start = subDays(now, 60);
  const recent = await getCompletedSessionCountInRange(userId, last30Start, now);
  const previous = await getCompletedSessionCountInRange(userId, prev60Start, last30Start);

  const [{ totalCompleted }] = await db
    .select({ totalCompleted: count() })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, userId),
        eq(trainingSessions.status, "completed"),
      ),
    );

  const trendPct =
    previous === 0 ? (recent > 0 ? 100 : 0) : Math.round(((recent - previous) / previous) * 100);

  return { totalCompleted: Number(totalCompleted), trendPct };
}

function toUtcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getUserTrainingStreakDays(userId: number): Promise<number> {
  const completed = await db
    .select({ completedAt: trainingSessions.completedAt })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, userId),
        eq(trainingSessions.status, "completed"),
        isNotNull(trainingSessions.completedAt),
      ),
    );

  const days = new Set<string>();
  for (const row of completed) {
    if (!row.completedAt) continue;
    days.add(toUtcDayKey(new Date(row.completedAt)));
  }
  if (days.size === 0) return 0;

  const now = new Date();
  const today = toUtcDayKey(now);
  const yesterday = toUtcDayKey(subDays(now, 1));

  if (!days.has(today) && !days.has(yesterday)) {
    return 0;
  }

  const anchor = days.has(today) ? today : yesterday;
  let streak = 0;
  let cursor = new Date(`${anchor}T12:00:00.000Z`);
  while (days.has(toUtcDayKey(cursor))) {
    streak += 1;
    cursor = subDays(cursor, 1);
  }
  return streak;
}

export async function getUserAverageCompletedScore(
  userId: number,
): Promise<number | null> {
  const [{ avg }] = await db
    .select({
      avg: sql<number | null>`round(avg(${trainingSessions.finalScore})::numeric, 1)`,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, userId),
        eq(trainingSessions.status, "completed"),
        isNotNull(trainingSessions.finalScore),
      ),
    );
  return avg === null || Number.isNaN(Number(avg)) ? null : Number(avg);
}

export async function getUserLeaderboardRank(userId: number): Promise<number | null> {
  const avgs = await db
    .select({
      userId: trainingSessions.userId,
      avgScore: sql<number>`avg(${trainingSessions.finalScore})::float`,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.status, "completed"),
        isNotNull(trainingSessions.finalScore),
      ),
    )
    .groupBy(trainingSessions.userId)
    .orderBy(sql`avg(${trainingSessions.finalScore}) desc`);

  const idx = avgs.findIndex((r) => r.userId === userId);
  if (idx === -1) return null;
  return idx + 1;
}

export type CategoryRadarPoint = {
  category: Category;
  label: string;
  score: number;
};

const CATEGORY_LABELS: Record<Category, string> = {
  network_security: "Network",
  web_security: "Web",
  cloud_security: "Cloud",
  incident_response: "IR",
  malware_analysis: "Malware",
  forensics: "Forensics",
};

export async function getUserCategoryRadarScores(
  userId: number,
): Promise<CategoryRadarPoint[]> {
  const rows = await db
    .select({
      category: skillAssessments.category,
      avgScore: sql<number>`round(avg(${skillAssessments.score})::numeric, 0)::int`,
    })
    .from(skillAssessments)
    .where(
      and(
        eq(skillAssessments.userId, userId),
        inArray(skillAssessments.category, [...SCENARIO_CATEGORIES]),
      ),
    )
    .groupBy(skillAssessments.category);

  const byCat = new Map(rows.map((r) => [r.category, r.avgScore]));

  return SCENARIO_CATEGORIES.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    score: byCat.get(category) ?? 0,
  }));
}

export async function getSkillMatrixForUser(userId: number) {
  return db
    .select({
      category: skillAssessments.category,
      skill: skillAssessments.skill,
      score: skillAssessments.score,
      assessedAt: skillAssessments.assessedAt,
    })
    .from(skillAssessments)
    .where(eq(skillAssessments.userId, userId))
    .orderBy(asc(skillAssessments.category), asc(skillAssessments.skill));
}

export async function getCompletedScenarioScores(userId: number) {
  return db
    .select({
      sessionId: trainingSessions.id,
      scenarioName: scenarios.name,
      difficulty: scenarios.difficulty,
      finalScore: trainingSessions.finalScore,
      completedAt: trainingSessions.completedAt,
    })
    .from(trainingSessions)
    .innerJoin(scenarios, eq(trainingSessions.scenarioId, scenarios.id))
    .where(
      and(
        eq(trainingSessions.userId, userId),
        eq(trainingSessions.status, "completed"),
        isNotNull(trainingSessions.finalScore),
      ),
    )
    .orderBy(desc(trainingSessions.completedAt));
}

export type ScoreHistoryPoint = { date: string; score: number };

export async function getUserScoreHistory(
  userId: number,
  limit = 24,
): Promise<ScoreHistoryPoint[]> {
  const rows = await db
    .select({
      completedAt: trainingSessions.completedAt,
      finalScore: trainingSessions.finalScore,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, userId),
        eq(trainingSessions.status, "completed"),
        isNotNull(trainingSessions.finalScore),
        isNotNull(trainingSessions.completedAt),
      ),
    )
    .orderBy(desc(trainingSessions.completedAt))
    .limit(limit);

  return [...rows]
    .reverse()
    .map((r) => ({
      date: r.completedAt ? new Date(r.completedAt).toISOString().slice(0, 10) : "",
      score: r.finalScore ?? 0,
    }));
}

export async function getTotalActiveScenarioCount(): Promise<number> {
  const [{ c }] = await db
    .select({ c: count() })
    .from(scenarios)
    .where(eq(scenarios.isActive, true));
  return Number(c);
}

export async function getUserCompletedScenarioCount(userId: number): Promise<number> {
  const [{ c }] = await db
    .select({ c: count() })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, userId),
        eq(trainingSessions.status, "completed"),
      ),
    );
  return Number(c);
}

export async function getUserAverageSkillScore(userId: number): Promise<number | null> {
  const [{ avg }] = await db
    .select({
      avg: sql<number | null>`round(avg(${skillAssessments.score})::numeric, 0)::int`,
    })
    .from(skillAssessments)
    .where(eq(skillAssessments.userId, userId));
  return avg === null ? null : Number(avg);
}

export function difficultyFromAverageSkill(avg: number | null): Difficulty {
  if (avg === null) return "beginner";
  if (avg < 55) return "beginner";
  if (avg < 70) return "intermediate";
  if (avg < 85) return "advanced";
  return "expert";
}

export async function getRecommendedScenarios(
  userId: number,
  limit = 3,
): Promise<(typeof scenarios.$inferSelect)[]> {
  const avg = await getUserAverageSkillScore(userId);
  const preferred = difficultyFromAverageSkill(avg);

  const preferredRows = await db
    .select()
    .from(scenarios)
    .where(and(eq(scenarios.isActive, true), eq(scenarios.difficulty, preferred)))
    .orderBy(asc(scenarios.name))
    .limit(limit);

  if (preferredRows.length >= limit) {
    return preferredRows;
  }

  const rest = await db
    .select()
    .from(scenarios)
    .where(and(eq(scenarios.isActive, true), ne(scenarios.difficulty, preferred)))
    .orderBy(asc(scenarios.name))
    .limit(limit - preferredRows.length);

  return [...preferredRows, ...rest];
}
