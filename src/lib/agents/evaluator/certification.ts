import { and, count, eq } from "drizzle-orm";

import { db } from "@/db/index";
import { trainingSessions, userCertifications } from "@/db/schema";

import { CERTIFICATIONS, type Certification } from "@/lib/agents/evaluator/certification-catalog";
import { getUserSkillMatrix } from "@/lib/agents/evaluator/skill-matrix";

export type { Certification, Requirement } from "@/lib/agents/evaluator/certification-catalog";
export { CERTIFICATIONS } from "@/lib/agents/evaluator/certification-catalog";

async function completedCount(userId: number): Promise<number> {
  const [{ c }] = await db
    .select({ c: count() })
    .from(trainingSessions)
    .where(and(eq(trainingSessions.userId, userId), eq(trainingSessions.status, "completed")));
  return Number(c);
}

function categoryScore(matrix: Awaited<ReturnType<typeof getUserSkillMatrix>>, cat: string): number {
  const row = matrix.find((m) => m.name === cat);
  if (!row || row.skills.length === 0) return 0;
  return row.averageScore;
}

export async function hasCertification(userId: number, certId: string): Promise<boolean> {
  const row = await db.query.userCertifications.findFirst({
    where: and(eq(userCertifications.userId, userId), eq(userCertifications.certificationId, certId)),
  });
  return Boolean(row);
}

export async function checkCertifications(userId: number): Promise<Certification[]> {
  const matrix = await getUserSkillMatrix(userId);
  const sessions = await completedCount(userId);
  const avgOverall =
    matrix.length === 0
      ? 0
      : Math.round(matrix.reduce((s, c) => s + c.averageScore, 0) / matrix.length);

  const earned: Certification[] = [];
  for (const cert of CERTIFICATIONS) {
    if (await hasCertification(userId, cert.id)) continue;

    let ok = true;
    for (const r of cert.requirements) {
      if (categoryScore(matrix, r.skillCategory) < r.minimumScore) ok = false;
    }
    const minScenarios = Math.max(...cert.requirements.map((r) => r.scenariosCompleted));
    if (sessions < minScenarios) ok = false;

    if (cert.id === "security_engineer" && avgOverall < 80) ok = false;

    if (ok) {
      try {
        await db.insert(userCertifications).values({ userId, certificationId: cert.id });
      } catch {
        /* duplicate */
      }
      earned.push(cert);
    }
  }
  return earned;
}
