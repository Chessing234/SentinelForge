import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db/index";
import { scenarios, skillAssessments, trainingSessions } from "@/db/schema";
import type { Category } from "@/types";

export interface Skill {
  name: string;
  score: number;
  confidence: number;
  trend: "improving" | "stable" | "declining";
  assessments: number;
}

export interface SkillCategory {
  name: string;
  skills: Skill[];
  averageScore: number;
}

export interface SkillGap {
  category: string;
  skill: string;
  currentScore: number;
  gap: number;
  recommendedScenarioIds: number[];
}

async function assessmentsGrouped(userId: number) {
  const rows = await db
    .select()
    .from(skillAssessments)
    .where(eq(skillAssessments.userId, userId))
    .orderBy(desc(skillAssessments.assessedAt));

  const map = new Map<string, (typeof rows)[number][]>();
  for (const r of rows) {
    const k = `${r.category}|${r.skill}`;
    const arr = map.get(k) ?? [];
    arr.push(r);
    map.set(k, arr);
  }
  return map;
}

function trendForHistory(scores: number[]): "improving" | "stable" | "declining" {
  if (scores.length < 2) return "stable";
  const last3 = scores.slice(0, Math.min(3, scores.length));
  const prev3 = scores.slice(3, Math.min(6, scores.length));
  const a = last3.reduce((s, x) => s + x, 0) / last3.length;
  const b = prev3.length ? prev3.reduce((s, x) => s + x, 0) / prev3.length : a;
  if (a > b + 3) return "improving";
  if (a < b - 3) return "declining";
  return "stable";
}

export async function getUserSkillMatrix(userId: number): Promise<SkillCategory[]> {
  const map = await assessmentsGrouped(userId);
  const byCat = new Map<string, Skill[]>();

  for (const [, arr] of map) {
    const latest = arr[0]!;
    const scores = arr.map((x) => x.score);
    const skill: Skill = {
      name: latest.skill,
      score: latest.score,
      confidence: latest.confidence ? Number(latest.confidence) : 0.5,
      trend: trendForHistory(scores),
      assessments: arr.length,
    };
    const list = byCat.get(latest.category) ?? [];
    list.push(skill);
    byCat.set(latest.category, list);
  }

  const out: SkillCategory[] = [];
  for (const [name, skills] of byCat) {
    const avg =
      skills.length === 0 ? 0 : Math.round(skills.reduce((s, x) => s + x.score, 0) / skills.length);
    out.push({
      name,
      skills: skills.sort((a, b) => a.name.localeCompare(b.name)),
      averageScore: avg,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getSkillGaps(userId: number): Promise<SkillGap[]> {
  const matrix = await getUserSkillMatrix(userId);
  const gaps: SkillGap[] = [];
  for (const cat of matrix) {
    for (const sk of cat.skills) {
      if (sk.score >= 60) continue;
      const gap = 60 - sk.score;
      const rec = await db
        .select({ id: scenarios.id })
        .from(scenarios)
        .where(and(eq(scenarios.isActive, true), eq(scenarios.category, cat.name as Category)))
        .orderBy(asc(scenarios.difficulty))
        .limit(3);
      gaps.push({
        category: cat.name,
        skill: sk.name,
        currentScore: sk.score,
        gap,
        recommendedScenarioIds: rec.map((r) => r.id),
      });
    }
  }
  return gaps.sort((a, b) => b.gap - a.gap);
}

async function scenarioIdsWithGradeA(userId: number): Promise<Set<number>> {
  const rows = await db
    .select({ sid: trainingSessions.scenarioId })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, userId),
        eq(trainingSessions.status, "completed"),
        sql`${trainingSessions.finalScore} >= 85`,
      ),
    );
  return new Set(rows.map((r) => r.sid));
}

export async function getRecommendedScenarios(
  userId: number,
): Promise<(typeof scenarios.$inferSelect)[]> {
  const gaps = await getSkillGaps(userId);
  const exclude = await scenarioIdsWithGradeA(userId);
  const preferredCats = [...new Set(gaps.map((g) => g.category))];
  const out: (typeof scenarios.$inferSelect)[] = [];

  const cats = preferredCats.length ? preferredCats : ["network_security"];
  for (const cat of cats) {
    const rows = await db
      .select()
      .from(scenarios)
      .where(
        and(
          eq(scenarios.isActive, true),
          eq(scenarios.category, cat as Category),
          inArray(scenarios.difficulty, ["beginner", "intermediate"]),
        ),
      )
      .orderBy(asc(scenarios.name))
      .limit(6);
    for (const r of rows) {
      if (exclude.has(r.id)) continue;
      if (!out.some((x) => x.id === r.id)) out.push(r);
      if (out.length >= 3) return out;
    }
  }

  if (out.length < 3) {
    const rest = await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.isActive, true))
      .orderBy(asc(scenarios.name))
      .limit(10);
    for (const r of rest) {
      if (exclude.has(r.id)) continue;
      if (!out.some((x) => x.id === r.id)) out.push(r);
      if (out.length >= 3) break;
    }
  }
  return out.slice(0, 3);
}
