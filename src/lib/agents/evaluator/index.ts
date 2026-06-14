import { createSessionEvent, getSessionEvents, getTrainingSessionForUser, updateSession } from "@/db/queries";
import {
  getOrganizationAnalytics as fetchOrganizationAnalytics,
  getScenarioAnalytics as fetchScenarioAnalytics,
  getTeamProgress as fetchTeamProgress,
} from "@/lib/agents/evaluator/analytics";
import { calculateScore, updateSkillMatrix, type ScoreBreakdown } from "@/lib/agents/evaluator/scoring";
import {
  getRecommendedScenarios,
  getSkillGaps as computeSkillGaps,
  getUserSkillMatrix,
  type SkillCategory,
  type SkillGap,
} from "@/lib/agents/evaluator/skill-matrix";
import {
  checkCertifications as awardCertifications,
  hasCertification,
  type Certification,
} from "@/lib/agents/evaluator/certification";
import type { scenarios } from "@/db/schema";

export type { ScoreBreakdown, Certification, SkillCategory, SkillGap };
export { calculateScore } from "@/lib/agents/evaluator/scoring";
export { orgAnalyticsToCsv } from "@/lib/agents/evaluator/analytics";

export class EvaluatorAgent {
  async evaluateSession(sessionId: number, userId: number): Promise<ScoreBreakdown> {
    const owned = await getTrainingSessionForUser(sessionId, userId);
    if (!owned?.scenario) {
      throw new Error("Session not found or access denied");
    }

    const events = await getSessionEvents(sessionId);
    const breakdown = calculateScore(sessionId, owned, owned.scenario, events);

    if (owned.status === "completed" && owned.finalScore != null) {
      return breakdown;
    }

    await updateSession(sessionId, {
      status: "completed",
      completedAt: new Date(),
      finalScore: breakdown.totalScore,
      timeSpent: breakdown.timeSpent,
    });

    await createSessionEvent({
      sessionId,
      eventType: "session_completed",
      payload: {
        totalScore: breakdown.totalScore,
        grade: breakdown.grade,
      },
    });

    void import("@/lib/slack/notifications").then(({ slackNotificationService }) =>
      slackNotificationService.notifySessionCompleted(sessionId).catch(() => undefined),
    );

    await updateSkillMatrix(userId, owned.scenario.category, breakdown);
    await awardCertifications(userId);
    return breakdown;
  }

  async getSkillMatrix(userId: number): Promise<SkillCategory[]> {
    return getUserSkillMatrix(userId);
  }

  async getSkillGaps(userId: number): Promise<SkillGap[]> {
    return computeSkillGaps(userId);
  }

  async getRecommendations(userId: number): Promise<(typeof scenarios.$inferSelect)[]> {
    return getRecommendedScenarios(userId);
  }

  async getOrganizationAnalytics(orgId: number) {
    return fetchOrganizationAnalytics(orgId);
  }

  async getTeamProgress(orgId: number) {
    return fetchTeamProgress(orgId);
  }

  async getScenarioAnalytics(scenarioId: number) {
    return fetchScenarioAnalytics(scenarioId);
  }

  async checkCertifications(userId: number): Promise<Certification[]> {
    return awardCertifications(userId);
  }

  async hasCertification(userId: number, certId: string): Promise<boolean> {
    return hasCertification(userId, certId);
  }
}

export const evaluatorAgent = new EvaluatorAgent();
