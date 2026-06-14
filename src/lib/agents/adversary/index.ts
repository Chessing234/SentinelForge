import { createSessionEvent, getTrainingSessionForUser } from "@/db/queries";
import type { AttackChain, AttackStep } from "@/lib/agents/adversary/attack-chain";
import { toAttackChainOverview } from "@/lib/agents/adversary/attack-chain";
import { generateAttackChain } from "@/lib/agents/adversary/chain-generator";
import { executeStep } from "@/lib/agents/adversary/executor";
import { generateIOCs } from "@/lib/agents/adversary/indicators";
import { scoreDetection, type DetectionScore } from "@/lib/agents/adversary/scoring";
import { loadState, saveState, touchExpiry } from "@/lib/agents/environment/session-store";

export type { DetectionScore };

export class AdversaryAgent {
  async planAttack(sessionId: number, userId: number): Promise<{ chain: AttackChain; overview: ReturnType<typeof toAttackChainOverview> }> {
    const owned = await getTrainingSessionForUser(sessionId, userId);
    if (!owned) {
      throw new Error("Session not found or access denied");
    }

    const payload = loadState(sessionId);
    if (!payload) {
      throw new Error("Environment not initialized for this session");
    }

    const chain = await generateAttackChain(payload.scenarioId, payload.topology, sessionId);
    chain.status = "planned";
    payload.attackChain = chain;
    saveState(sessionId, payload);
    touchExpiry(sessionId);

    await createSessionEvent({
      sessionId,
      eventType: "attack_started",
      payload: { adversary: "plan", overview: toAttackChainOverview(chain) },
    });

    return { chain, overview: toAttackChainOverview(chain) };
  }

  async executeNextStep(sessionId: number, userId: number): Promise<AttackStep | null> {
    const owned = await getTrainingSessionForUser(sessionId, userId);
    if (!owned) {
      throw new Error("Session not found or access denied");
    }

    const payload = loadState(sessionId);
    if (!payload?.attackChain) {
      return null;
    }

    const chain = payload.attackChain;
    const next = chain.steps.find((s) => s.status === "pending");
    if (!next) {
      chain.status = "completed";
      chain.endTime = new Date();
      saveState(sessionId, payload);
      return null;
    }

    chain.status = "in_progress";
    executeStep(sessionId, next, payload.topology, payload);
    chain.currentStep = chain.steps.filter((s) => s.status === "completed").length;

    if (!chain.steps.some((s) => s.status === "pending")) {
      chain.status = "completed";
      chain.endTime = new Date();
    }

    saveState(sessionId, payload);
    touchExpiry(sessionId);

    await createSessionEvent({
      sessionId,
      eventType: "milestone_reached",
      payload: {
        adversary: "step",
        techniqueId: next.technique.id,
        stepId: next.id,
        artifacts: next.artifacts.length,
      },
    });

    return next;
  }

  async executeAll(sessionId: number, userId: number): Promise<AttackChain> {
    let step: AttackStep | null;
    do {
      step = await this.executeNextStep(sessionId, userId);
    } while (step);

    const payload = loadState(sessionId);
    if (!payload?.attackChain) {
      throw new Error("Attack chain missing");
    }
    return payload.attackChain;
  }

  async getStatus(sessionId: number, userId: number): Promise<AttackChain | null> {
    const owned = await getTrainingSessionForUser(sessionId, userId);
    if (!owned) return null;
    const payload = loadState(sessionId);
    touchExpiry(sessionId);
    return payload?.attackChain ?? null;
  }

  async getIOCs(sessionId: number, userId: number): Promise<ReturnType<typeof generateIOCs>> {
    const chain = await this.getStatus(sessionId, userId);
    if (!chain) return [];
    return generateIOCs(chain);
  }

  async validateDetection(
    sessionId: number,
    userId: number,
    detection: string,
  ): Promise<{ correct: boolean; score: DetectionScore } | null> {
    const chain = await this.getStatus(sessionId, userId);
    if (!chain) return null;
    const result = scoreDetection(chain, detection);
    const payload = loadState(sessionId);
    if (payload) {
      payload.detectionHistory = payload.detectionHistory ?? [];
      payload.detectionHistory.push({
        submitted: detection,
        scorePercent: result.scorePercent,
        at: new Date().toISOString(),
      });
      saveState(sessionId, payload);
    }

    await createSessionEvent({
      sessionId,
      eventType: "milestone_reached",
      payload: {
        adversary: "detection_hypothesis",
        score: result.scorePercent,
        feedback: result.feedback,
        submitted: detection,
      },
    });

    if (result.scorePercent >= 60) {
      await createSessionEvent({
        sessionId,
        eventType: "attack_detected",
        payload: {
          adversary: "detection_confirmed",
          score: result.scorePercent,
          matchedTechniqueId: result.matchedTechniqueId,
        },
      });
    }

    return { correct: result.scorePercent >= 60, score: result };
  }

  async scoreDetectionForSession(
    sessionId: number,
    userId: number,
    submittedAnswer: string,
  ): Promise<DetectionScore | null> {
    const chain = await this.getStatus(sessionId, userId);
    if (!chain) return null;
    return scoreDetection(chain, submittedAnswer);
  }
}

export const adversaryAgent = new AdversaryAgent();

export { toAttackChainOverview };
