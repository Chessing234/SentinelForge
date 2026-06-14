import type { AttackChain, AttackIndicator } from "@/lib/agents/adversary/attack-chain";
import { loadState } from "@/lib/agents/environment/session-store";

export function generateIOCs(chain: AttackChain): AttackIndicator[] {
  const out: AttackIndicator[] = [];
  for (const step of chain.steps) {
    if (step.status !== "completed") continue;
    out.push(...step.indicators);
  }
  return dedupeIndicators(out);
}

function dedupeIndicators(items: AttackIndicator[]): AttackIndicator[] {
  const seen = new Set<string>();
  const res: AttackIndicator[] = [];
  for (const i of items) {
    const k = `${i.type}:${i.value}:${i.path ?? ""}`;
    if (seen.has(k)) continue;
    seen.add(k);
    res.push(i);
  }
  return res;
}

const TOOL_MAP: Record<string, (i: AttackIndicator) => boolean> = {
  netstat: (i) => i.type === "network" || i.detectableWith.includes("netstat"),
  ps: (i) => i.type === "process" || i.detectableWith.includes("ps"),
  top: (i) => i.type === "process" || i.detectableWith.includes("top"),
  grep: (i) => i.detectableWith.includes("grep"),
  find: (i) => i.detectableWith.includes("find"),
  ls: (i) => i.detectableWith.includes("ls") || Boolean(i.path?.includes("/tmp")),
  cat: (i) => i.detectableWith.includes("cat"),
  strings: (i) => i.detectableWith.includes("strings"),
};

export function getDetectableIOCs(sessionId: number, toolName: string): AttackIndicator[] {
  const payload = loadState(sessionId);
  if (!payload?.attackChain) return [];
  const all = generateIOCs(payload.attackChain);
  const key = toolName.trim().toLowerCase();
  const pred = TOOL_MAP[key];
  if (!pred) {
    return all;
  }
  return all.filter(pred);
}
