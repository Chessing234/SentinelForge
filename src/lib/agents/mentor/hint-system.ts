import { getDetectableIOCs } from "@/lib/agents/adversary/indicators";
import type { MentorContext } from "@/lib/agents/mentor/context-builder";
import { loadState, saveState } from "@/lib/agents/environment/session-store";

export interface Hint {
  level: 1 | 2 | 3;
  content: string;
  type: "directional" | "tool_suggestion" | "specific";
}

export function getMentorHintStepKey(ctx: MentorContext): string {
  const chain = ctx.attackChain;
  if (!chain) return "general";
  const pending = chain.steps.find((s) => s.status === "pending");
  if (pending) return pending.id;
  const last = chain.steps[chain.steps.length - 1];
  return last?.id ?? "general";
}

function effectiveLevel(requested: 1 | 2 | 3, ctx: MentorContext): 1 | 2 | 3 {
  if (ctx.skillLevel === "struggling" && requested < 3) {
    return Math.min(3, (requested + 1) as 1 | 2 | 3) as 1 | 2 | 3;
  }
  return requested;
}

export function hintAlreadyUsed(sessionId: number, stepKey: string, level: 1 | 2 | 3): boolean {
  const payload = loadState(sessionId);
  const used = payload?.mentorState?.hintLevelsByStep[stepKey] ?? [];
  return used.includes(level);
}

export function getHintLevelsUsed(sessionId: number, stepKey: string): number[] {
  const payload = loadState(sessionId);
  return payload?.mentorState?.hintLevelsByStep[stepKey] ?? [];
}

function recordHintUsage(sessionId: number, stepKey: string, level: 1 | 2 | 3): void {
  const payload = loadState(sessionId);
  if (!payload) return;
  payload.mentorState = payload.mentorState ?? { hintLevelsByStep: {} };
  const map = payload.mentorState.hintLevelsByStep;
  const arr = map[stepKey] ?? [];
  if (!arr.includes(level)) arr.push(level);
  map[stepKey] = arr;
  saveState(sessionId, payload);
}

export function generateHint(sessionId: number, level: 1 | 2 | 3, ctx: MentorContext): Hint {
  const lvl = effectiveLevel(level, ctx);
  const pending = ctx.attackChain?.steps.find((s) => s.status === "pending");
  const tactic = pending?.technique.tactic ?? "Discovery";
  const netIOCs = getDetectableIOCs(sessionId, "netstat");
  const suspiciousPort =
    netIOCs.find((i) => i.value.includes("4444"))?.value ??
    "an unusual high port to a rare external IP";

  if (lvl === 1) {
    return {
      level: 1,
      type: "directional",
      content:
        tactic === "Initial Access" || tactic === "Discovery"
          ? "Have you mapped what is exposed on the network? Attackers often follow: visibility → weakness → foothold. What services stand out compared to a minimal baseline?"
          : "Have you looked at running processes and open sockets together? Suspicious persistence often pairs with outbound connections.",
    };
  }

  if (lvl === 2) {
    return {
      level: 2,
      type: "tool_suggestion",
      content:
        ctx.recentCommands.some((c) => /netstat/i.test(c))
          ? "Try pairing netstat with process inspection: identify a socket, then see which user owns that PID via ps. Timestamps in logs can confirm sequencing."
          : "Try `netstat -an` (or the lab equivalent) to list sockets, then `ps aux` filtered for suspicious names. If you staged data, `ls -la /tmp` is a common student check.",
    };
  }

  return {
    level: 3,
    type: "specific",
    content: pending
      ? `Focus on the next adversary objective area: ${tactic}. Look for artifacts tied to ${pending.technique.name} (${pending.technique.id}) without assuming every IOC is malicious—corroborate with two independent signals (file + process, or process + network). Lab cue: ${suspiciousPort}.`
      : `Strong hint: enumerate unexpected outbound connections and binaries in writable paths (/tmp, /var/tmp). In many classes, ${suspiciousPort} warrants a closer look at the owning process and parent chain.`,
  };
}

/**
 * Produces a hint, records usage for the current attack step (or "general"), and returns the hint object.
 */
export function generateAndRegisterHint(
  sessionId: number,
  level: 1 | 2 | 3,
  ctx: MentorContext,
): Hint {
  const stepKey = getMentorHintStepKey(ctx);
  const hint = generateHint(sessionId, level, ctx);
  hint.level = level;
  recordHintUsage(sessionId, stepKey, level);
  return hint;
}
