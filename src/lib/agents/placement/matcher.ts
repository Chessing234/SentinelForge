import { and, count, eq, isNotNull } from "drizzle-orm";

import { db } from "@/db/index";
import { scenarios, trainingSessions } from "@/db/schema";
import type { jobs } from "@/db/schema";
import { listUserCertifications } from "@/db/queries";
import { getUserSkillMatrix, getSkillGaps, type SkillGap } from "@/lib/agents/evaluator/skill-matrix";
import { parsePreferredCertificationIds, parseRequiredSkills } from "@/lib/agents/placement/parse-job-skills";

export type { JobRequiredSkill } from "@/lib/agents/placement/parse-job-skills";
export { parseRequiredSkills } from "@/lib/agents/placement/parse-job-skills";

export type MatchRecommendation = "strong" | "good" | "potential" | "not_recommended";

export interface MatchResult {
  userId: number;
  jobId: number;
  overallScore: number;
  skillMatch: number;
  experienceMatch: number;
  certificationMatch: number;
  gapAnalysis: SkillGap[];
  recommendation: MatchRecommendation;
}

const DIFF_WEIGHT: Record<string, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

function recommendationFromScore(overall: number): MatchRecommendation {
  if (overall >= 85) return "strong";
  if (overall >= 70) return "good";
  if (overall >= 60) return "potential";
  return "not_recommended";
}

export async function calculateMatch(userId: number, job: typeof jobs.$inferSelect): Promise<MatchResult> {
  const matrix = await getUserSkillMatrix(userId);
  const gapsAll = await getSkillGaps(userId);
  const required = parseRequiredSkills(job.requiredSkills);

  const catScore = new Map<string, number>();
  for (const cat of matrix) {
    catScore.set(cat.name, cat.averageScore);
  }

  let skillParts: number[] = [];
  const gapAnalysis: SkillGap[] = [];

  for (const req of required) {
    const userScore = catScore.get(req.key) ?? 0;
    const ratio = req.minScore <= 0 ? 1 : Math.min(1, userScore / req.minScore);
    skillParts.push(ratio * 100);
    if (userScore < req.minScore) {
      const existing = gapsAll.find((g) => g.category === req.key);
      gapAnalysis.push(
        existing ?? {
          category: req.key,
          skill: req.label,
          currentScore: userScore,
          gap: req.minScore - userScore,
          recommendedScenarioIds: [],
        },
      );
    }
  }

  if (skillParts.length === 0) {
    skillParts = [matrix.length ? matrix.reduce((s, c) => s + c.averageScore, 0) / matrix.length : 0];
  }

  const skillMatch = Math.round(skillParts.reduce((a, b) => a + b, 0) / skillParts.length);

  const completed = await db
    .select({
      difficulty: scenarios.difficulty,
      n: count(),
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
    .groupBy(scenarios.difficulty);

  let weightSum = 0;
  for (const row of completed) {
    const w = DIFF_WEIGHT[row.difficulty] ?? 1;
    weightSum += w * Number(row.n);
  }
  const experienceMatch = Math.min(100, Math.round((weightSum / 24) * 100));

  const preferred = parsePreferredCertificationIds(job.preferredCertifications);
  const earned = await listUserCertifications(userId);
  const earnedSet = new Set(earned.map((e) => e.certificationId));
  const certificationMatch =
    preferred.length === 0
      ? 100
      : Math.round((preferred.filter((id) => earnedSet.has(id)).length / preferred.length) * 100);

  const overallScore = Math.round(skillMatch * 0.5 + experienceMatch * 0.25 + certificationMatch * 0.25);

  return {
    userId,
    jobId: job.id,
    overallScore,
    skillMatch,
    experienceMatch,
    certificationMatch,
    gapAnalysis,
    recommendation: recommendationFromScore(overallScore),
  };
}

export async function findCandidates(
  job: typeof jobs.$inferSelect,
  userIds: number[],
  minScore = 60,
): Promise<MatchResult[]> {
  const results: MatchResult[] = [];
  for (const uid of userIds) {
    if (uid <= 0) continue;
    const m = await calculateMatch(uid, job);
    if (m.overallScore >= minScore) {
      results.push(m);
    }
  }
  results.sort((a, b) => b.overallScore - a.overallScore);
  return results.slice(0, 20);
}