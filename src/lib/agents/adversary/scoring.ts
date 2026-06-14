import type { AttackChain } from "@/lib/agents/adversary/attack-chain";
import { getMitreTechnique } from "@/lib/agents/adversary/mitre";

export type DetectionScore = {
  scorePercent: number;
  matchedTechniqueId?: string;
  matchedTactic?: string;
  feedback: string;
  detectedSteps: string[];
  missedSteps: string[];
};

function normalize(s: string): string {
  return s.trim().toUpperCase();
}

function tacticOfTechniqueId(id: string): string | undefined {
  return getMitreTechnique(id)?.tactic;
}

export function scoreDetection(
  chain: AttackChain,
  submittedAnswer: string,
): DetectionScore {
  const raw = submittedAnswer.trim();
  const completed = chain.steps.filter((s) => s.status === "completed");
  const missed = chain.steps.filter((s) => s.status === "pending").map((s) => s.technique.id);
  const detected: string[] = [];

  const exact = completed.find((s) => normalize(s.technique.id) === normalize(raw));
  if (exact) {
    detected.push(exact.technique.id);
    return {
      scorePercent: 100,
      matchedTechniqueId: exact.technique.id,
      matchedTactic: exact.technique.tactic,
      feedback: "Exact MITRE technique match.",
      detectedSteps: detected,
      missedSteps: missed,
    };
  }

  const tacticMatch = completed.find((s) => normalize(s.technique.tactic) === normalize(raw));
  if (tacticMatch) {
    detected.push(tacticMatch.technique.id);
    return {
      scorePercent: 60,
      matchedTechniqueId: tacticMatch.technique.id,
      matchedTactic: tacticMatch.technique.tactic,
      feedback: "Correct tactic family, but technique ID differs.",
      detectedSteps: detected,
      missedSteps: missed,
    };
  }

  const related = completed.find((s) => {
    const prefix = s.technique.id.split(".")[0];
    return prefix && raw.includes(prefix);
  });
  if (related) {
    return {
      scorePercent: 40,
      matchedTechniqueId: related.technique.id,
      matchedTactic: related.technique.tactic,
      feedback: "Related technique family (prefix match).",
      detectedSteps: [related.technique.id],
      missedSteps: missed,
    };
  }

  const tacticFromId = tacticOfTechniqueId(raw.replace(/\s+/g, ""));
  if (tacticFromId) {
    const anySameTactic = completed.find((s) => s.technique.tactic === tacticFromId);
    if (anySameTactic) {
      return {
        scorePercent: 40,
        matchedTechniqueId: anySameTactic.technique.id,
        matchedTactic: tacticFromId,
        feedback: "Submitted ID is valid MITRE but not the executed step; partial credit for tactic alignment.",
        detectedSteps: [anySameTactic.technique.id],
        missedSteps: missed,
      };
    }
  }

  return {
    scorePercent: 0,
    feedback: "No match to executed adversary techniques in this session.",
    detectedSteps: [],
    missedSteps: chain.steps.map((s) => s.technique.id),
  };
}
