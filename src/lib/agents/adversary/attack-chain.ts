import type { MitreTechnique } from "@/lib/agents/adversary/mitre";

export interface AttackIndicator {
  type: "file" | "process" | "network" | "registry" | "log";
  path?: string;
  value: string;
  description: string;
  detectableWith: string[];
}

export interface AttackArtifact {
  type: string;
  location: string;
  content: string;
  isEvidence: boolean;
}

export interface AttackStep {
  id: string;
  technique: MitreTechnique;
  targetHostId: string;
  description: string;
  indicators: AttackIndicator[];
  artifacts: AttackArtifact[];
  timestamp: Date;
  status: "pending" | "executing" | "completed" | "blocked";
}

export interface AttackChain {
  id: string;
  name: string;
  objective: string;
  steps: AttackStep[];
  currentStep: number;
  startTime: Date;
  endTime?: Date;
  status: "planned" | "in_progress" | "completed" | "detected";
}

export type AttackChainOverview = {
  id: string;
  name: string;
  objective: string;
  status: AttackChain["status"];
  totalSteps: number;
  currentStep: number;
  /** Technique IDs only — full steps hidden until executed in lab */
  completedTechniqueIds: string[];
  pendingCount: number;
};

export function toAttackChainOverview(chain: AttackChain): AttackChainOverview {
  const completedTechniqueIds = chain.steps
    .filter((s) => s.status === "completed")
    .map((s) => s.technique.id);
  return {
    id: chain.id,
    name: chain.name,
    objective: chain.objective,
    status: chain.status,
    totalSteps: chain.steps.length,
    currentStep: chain.currentStep,
    completedTechniqueIds,
    pendingCount: chain.steps.filter((s) => s.status === "pending").length,
  };
}
