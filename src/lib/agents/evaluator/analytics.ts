import { subDays } from "date-fns";
import { and, count, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";

import { db } from "@/db/index";
import { scenarios, trainingSessions, users } from "@/db/schema";

export type RiskLevel = "low" | "medium" | "high";

export interface UserScore {
  userId: number;
  name: string;
  email: string;
  averageScore: number;
  sessionsCompleted: number;
}

export interface CategoryScore {
  category: string;
  averageScore: number;
  sessions: number;
}

export interface WeekData {
  weekStart: string;
  sessions: number;
}

export interface OrgAnalytics {
  totalUsers: number;
  activeUsersThisMonth: number;
  totalSessions: number;
  averageScore: number;
  completionRate: number;
  topPerformers: UserScore[];
  strugglingUsers: UserScore[];
  categoryBreakdown: CategoryScore[];
  weeklyActivity: WeekData[];
  riskAssessment: RiskLevel;
}

export interface TeamMember {
  userId: number;
  name: string;
  role: string;
  sessionsCompleted: number;
  averageScore: number | null;
  lastActive: string | null;
  badges: string[];
}

export interface ScenarioAnalytics {
  scenarioId: number;
  name: string;
  completionRate: number;
  averageScore: number | null;
  averageTimeSeconds: number | null;
  commonMistakes: string[];
  inferredDifficulty: string;
}

function riskFromAvg(avg: number | null): RiskLevel {
  if (avg === null) return "medium";
  if (avg >= 75) return "low";
  if (avg >= 60) return "medium";
  return "high";
}

export async function getOrganizationAnalytics(orgId: number): Promise<OrgAnalytics> {
  const monthAgo = subDays(new Date(), 30);
  const [{ totalUsers }] = await db
    .select({ totalUsers: count() })
    .from(users)
    .where(eq(users.organizationId, orgId));

  const [{ c: activeUsersCt }] = await db
    .select({
      c: sql<number>`count(distinct ${trainingSessions.userId})::int`,
    })
    .from(trainingSessions)
    .innerJoin(users, eq(trainingSessions.userId, users.id))
    .where(and(eq(users.organizationId, orgId), gte(trainingSessions.createdAt, monthAgo)));
  const activeUsersThisMonth = Number(activeUsersCt);

  const [{ totalSessions }] = await db
    .select({ totalSessions: count() })
    .from(trainingSessions)
    .innerJoin(users, eq(trainingSessions.userId, users.id))
    .where(eq(users.organizationId, orgId));

  const [{ completed }] = await db
    .select({ completed: count() })
    .from(trainingSessions)
    .innerJoin(users, eq(trainingSessions.userId, users.id))
    .where(and(eq(users.organizationId, orgId), eq(trainingSessions.status, "completed")));

  const [{ avgScore }] = await db
    .select({
      avgScore: sql<number | null>`round(avg(${trainingSessions.finalScore})::numeric, 1)`,
    })
    .from(trainingSessions)
    .innerJoin(users, eq(trainingSessions.userId, users.id))
    .where(
      and(
        eq(users.organizationId, orgId),
        eq(trainingSessions.status, "completed"),
        isNotNull(trainingSessions.finalScore),
      ),
    );

  const completionRate =
    Number(totalSessions) === 0 ? 0 : Math.round((Number(completed) / Number(totalSessions)) * 100);

  const userAvgs = await db
    .select({
      userId: trainingSessions.userId,
      name: users.name,
      email: users.email,
      avgScore: sql<number>`round(avg(${trainingSessions.finalScore})::numeric, 1)`,
      sessionsCompleted: sql<number>`count(*)::int`,
    })
    .from(trainingSessions)
    .innerJoin(users, eq(trainingSessions.userId, users.id))
    .where(
      and(
        eq(users.organizationId, orgId),
        eq(trainingSessions.status, "completed"),
        isNotNull(trainingSessions.finalScore),
      ),
    )
    .groupBy(trainingSessions.userId, users.name, users.email)
    .orderBy(sql`avg(${trainingSessions.finalScore}) desc`)
    .limit(20);

  const topPerformers: UserScore[] = userAvgs.slice(0, 5).map((r) => ({
    userId: r.userId,
    name: r.name,
    email: r.email,
    averageScore: Number(r.avgScore),
    sessionsCompleted: r.sessionsCompleted,
  }));

  const fourteen = subDays(new Date(), 14);
  const strugglingUsers: UserScore[] = [];
  for (const r of userAvgs) {
    const [lastRow] = await db
      .select({ last: sql<string | null>`max(${trainingSessions.completedAt})` })
      .from(trainingSessions)
      .where(and(eq(trainingSessions.userId, r.userId), eq(trainingSessions.status, "completed")));
    const last = lastRow?.last;
    const stale = !last || new Date(last) < fourteen;
    if (Number(r.avgScore) < 50 || stale) {
      strugglingUsers.push({
        userId: r.userId,
        name: r.name,
        email: r.email,
        averageScore: Number(r.avgScore),
        sessionsCompleted: r.sessionsCompleted,
      });
    }
  }

  const catRows = await db
    .select({
      category: scenarios.category,
      averageScore: sql<number | null>`round(avg(${trainingSessions.finalScore})::numeric, 1)`,
      sessions: sql<number>`count(*)::int`,
    })
    .from(trainingSessions)
    .innerJoin(scenarios, eq(trainingSessions.scenarioId, scenarios.id))
    .innerJoin(users, eq(trainingSessions.userId, users.id))
    .where(
      and(
        eq(users.organizationId, orgId),
        eq(trainingSessions.status, "completed"),
        isNotNull(trainingSessions.finalScore),
      ),
    )
    .groupBy(scenarios.category);

  const categoryBreakdown: CategoryScore[] = catRows.map((c) => ({
    category: c.category,
    averageScore: c.averageScore === null ? 0 : Number(c.averageScore),
    sessions: c.sessions,
  }));

  const weeklyActivity: WeekData[] = [];
  for (let i = 7; i >= 0; i -= 1) {
    const start = subDays(new Date(), i * 7);
    const end = subDays(new Date(), (i - 1) * 7);
    const [{ c }] = await db
      .select({ c: count() })
      .from(trainingSessions)
      .innerJoin(users, eq(trainingSessions.userId, users.id))
      .where(
        and(eq(users.organizationId, orgId), gte(trainingSessions.createdAt, start), lte(trainingSessions.createdAt, end)),
      );
    weeklyActivity.push({ weekStart: start.toISOString().slice(0, 10), sessions: Number(c) });
  }

  return {
    totalUsers: Number(totalUsers),
    activeUsersThisMonth,
    totalSessions: Number(totalSessions),
    averageScore: avgScore === null ? 0 : Number(avgScore),
    completionRate,
    topPerformers,
    strugglingUsers: strugglingUsers.slice(0, 12),
    categoryBreakdown,
    weeklyActivity,
    riskAssessment: riskFromAvg(avgScore === null ? null : Number(avgScore)),
  };
}

export async function getTeamProgress(orgId: number): Promise<TeamMember[]> {
  const rows = await db.query.users.findMany({
    where: eq(users.organizationId, orgId),
    orderBy: (u, { asc: a }) => [a(u.name)],
  });

  const out: TeamMember[] = [];
  for (const u of rows) {
    const [{ sessionsCompleted }] = await db
      .select({ sessionsCompleted: count() })
      .from(trainingSessions)
      .where(and(eq(trainingSessions.userId, u.id), eq(trainingSessions.status, "completed")));

    const [{ avgScore }] = await db
      .select({
        avgScore: sql<number | null>`round(avg(${trainingSessions.finalScore})::numeric, 1)`,
      })
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.userId, u.id),
          eq(trainingSessions.status, "completed"),
          isNotNull(trainingSessions.finalScore),
        ),
      );

    const [last] = await db
      .select({ completedAt: trainingSessions.completedAt })
      .from(trainingSessions)
      .where(eq(trainingSessions.userId, u.id))
      .orderBy(desc(trainingSessions.completedAt))
      .limit(1);

    out.push({
      userId: u.id,
      name: u.name,
      role: u.role,
      sessionsCompleted: Number(sessionsCompleted),
      averageScore: avgScore === null ? null : Number(avgScore),
      lastActive: last?.completedAt?.toISOString() ?? null,
      badges: [],
    });
  }
  return out;
}

export async function getScenarioAnalytics(scenarioId: number): Promise<ScenarioAnalytics> {
  const [sc] = await db.select().from(scenarios).where(eq(scenarios.id, scenarioId)).limit(1);
  const [{ total }] = await db
    .select({ total: count() })
    .from(trainingSessions)
    .where(eq(trainingSessions.scenarioId, scenarioId));

  const [{ done }] = await db
    .select({ done: count() })
    .from(trainingSessions)
    .where(and(eq(trainingSessions.scenarioId, scenarioId), eq(trainingSessions.status, "completed")));

  const [{ avgScore, avgTime }] = await db
    .select({
      avgScore: sql<number | null>`round(avg(${trainingSessions.finalScore})::numeric, 1)`,
      avgTime: sql<number | null>`round(avg(${trainingSessions.timeSpent})::numeric, 0)`,
    })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.scenarioId, scenarioId),
        eq(trainingSessions.status, "completed"),
        isNotNull(trainingSessions.finalScore),
      ),
    );

  const completionRate = Number(total) === 0 ? 0 : Math.round((Number(done) / Number(total)) * 100);
  const scoreNum = avgScore === null ? null : Number(avgScore);
  let inferredDifficulty = sc?.difficulty ?? "beginner";
  if (scoreNum !== null) {
    if (scoreNum < 55) inferredDifficulty = "expert";
    else if (scoreNum < 70) inferredDifficulty = "advanced";
    else if (scoreNum < 80) inferredDifficulty = "intermediate";
    else inferredDifficulty = "beginner";
  }

  return {
    scenarioId,
    name: sc?.name ?? "Scenario",
    completionRate,
    averageScore: scoreNum,
    averageTimeSeconds: avgTime === null ? null : Number(avgTime),
    commonMistakes: ["High hint usage vs score", "Missed lateral movement indicators"],
    inferredDifficulty,
  };
}

export function orgAnalyticsToCsv(a: OrgAnalytics): string {
  const lines = [
    "metric,value",
    `totalUsers,${a.totalUsers}`,
    `activeUsersThisMonth,${a.activeUsersThisMonth}`,
    `totalSessions,${a.totalSessions}`,
    `averageScore,${a.averageScore}`,
    `completionRate,${a.completionRate}`,
    `riskAssessment,${a.riskAssessment}`,
    "",
    "topPerformers,name,email,avgScore,sessions",
    ...a.topPerformers.map((p) => `top,${p.name},${p.email},${p.averageScore},${p.sessionsCompleted}`),
    "",
    "strugglingUsers,name,email,avgScore,sessions",
    ...a.strugglingUsers.map((p) => `weak,${p.name},${p.email},${p.averageScore},${p.sessionsCompleted}`),
    "",
    "category,averageScore,sessions",
    ...a.categoryBreakdown.map((c) => `${c.category},${c.averageScore},${c.sessions}`),
    "",
    "weekStart,sessions",
    ...a.weeklyActivity.map((w) => `${w.weekStart},${w.sessions}`),
  ];
  return lines.join("\n");
}
