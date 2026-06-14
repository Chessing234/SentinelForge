import { getScenarioById } from "@/db/queries";
import type { NetworkTopology } from "@/lib/agents/types";
import { createSeededRandom } from "@/lib/agents/environment/rng";
import type { AttackChain, AttackStep } from "@/lib/agents/adversary/attack-chain";
import {
  MITRE_TECHNIQUES,
  type MitreDifficulty,
  type MitreTechnique,
  getMitreTechnique,
  resolveScenarioTechniqueIds,
} from "@/lib/agents/adversary/mitre";
import { staggeredAttackTimestamp } from "@/lib/agents/adversary/realism";

const TACTIC_ORDER = [
  "Initial Access",
  "Execution",
  "Persistence",
  "Privilege Escalation",
  "Defense Evasion",
  "Credential Access",
  "Discovery",
  "Lateral Movement",
  "Collection",
  "Exfiltration",
  "Impact",
];

function tacticIndex(tactic: string): number {
  const i = TACTIC_ORDER.indexOf(tactic);
  return i === -1 ? 99 : i;
}

function difficultyRank(d: MitreDifficulty): number {
  const map: Record<MitreDifficulty, number> = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
    expert: 4,
  };
  return map[d] ?? 1;
}

export function selectTechniques(
  available: MitreTechnique[],
  scenarioDifficulty: MitreDifficulty,
  count: number,
  rng: ReturnType<typeof createSeededRandom>,
  preferredIds: string[],
): MitreTechnique[] {
  const maxRank = difficultyRank(scenarioDifficulty);
  const pool = available.filter((t) => difficultyRank(t.difficulty) <= maxRank);
  const poolById = new Map(pool.map((t) => [t.id, t]));

  const orderedPool = [...pool].sort((a, b) => {
    const td = tacticIndex(a.tactic) - tacticIndex(b.tactic);
    if (td !== 0) return td;
    return a.id.localeCompare(b.id);
  });

  const selected: MitreTechnique[] = [];
  const ids = new Set<string>();

  const tryAdd = (t: MitreTechnique | undefined): boolean => {
    if (!t || ids.has(t.id)) return false;
    const prereqOk = t.requires.every((r) => ids.has(r));
    if (!prereqOk) return false;
    selected.push(t);
    ids.add(t.id);
    return true;
  };

  for (const pid of preferredIds) {
    if (selected.length >= count) break;
    const exact = getMitreTechnique(pid) ?? poolById.get(pid);
    if (exact) tryAdd(exact);
  }

  for (const t of orderedPool) {
    if (selected.length >= count) break;
    tryAdd(t);
  }

  if (selected.length < count) {
    for (const t of rng.shuffle([...orderedPool])) {
      if (selected.length >= count) break;
      if (ids.has(t.id)) continue;
      selected.push(t);
      ids.add(t.id);
    }
  }

  return selected.slice(0, count);
}

function stepCountForDifficulty(d: MitreDifficulty): number {
  if (d === "beginner") return 5;
  if (d === "intermediate") return 7;
  if (d === "advanced") return 9;
  return 11;
}

function pickTargetHost(
  topology: NetworkTopology,
  technique: MitreTechnique,
  rng: ReturnType<typeof createSeededRandom>,
): string {
  const withVuln = topology.hosts.filter((h) =>
    h.services.some((s) => s.vulnerabilities.some((v) => v.exploitable)),
  );
  const pool = withVuln.length > 0 ? withVuln : topology.hosts;
  const preferLinux =
    technique.id.includes("1059.004") ||
    technique.tactic === "Discovery" ||
    technique.id.startsWith("T1005");
  const linuxish = pool.filter((h) => /ubuntu|debian|centos|linux|amazon|sift/i.test(h.os));
  const candidates = linuxish.length > 0 && preferLinux ? linuxish : pool;
  return rng.pick(candidates).id;
}

export async function generateAttackChain(
  scenarioId: number,
  environment: NetworkTopology,
  sessionId: number,
): Promise<AttackChain> {
  const scenario = await getScenarioById(scenarioId);
  if (!scenario) {
    throw new Error(`Scenario ${scenarioId} not found`);
  }

  const rng = createSeededRandom(sessionId * 1009 + 1337);
  const preferred = resolveScenarioTechniqueIds(scenario.mitreTechniques);
  const diff = scenario.difficulty as MitreDifficulty;
  const count = Math.min(stepCountForDifficulty(diff), MITRE_TECHNIQUES.length);
  const techniques = selectTechniques(MITRE_TECHNIQUES, diff, count, rng, preferred);

  const steps: AttackStep[] = techniques.map((tech, idx) => ({
    id: `step-${sessionId}-${idx + 1}`,
    technique: tech,
    targetHostId: pickTargetHost(environment, tech, rng),
    description: `${tech.name} (${tech.id}) against lab host for scenario objectives`,
    indicators: [],
    artifacts: [],
    timestamp: staggeredAttackTimestamp(sessionId, idx, techniques.length),
    status: "pending",
  }));

  return {
    id: `chain-${sessionId}`,
    name: `MITRE-aligned chain — ${scenario.name}`,
    objective: scenario.description.slice(0, 240),
    steps,
    currentStep: 0,
    startTime: new Date(),
    status: "planned",
  };
}
