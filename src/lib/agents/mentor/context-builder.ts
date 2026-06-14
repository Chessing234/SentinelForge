import type { AttackChain } from "@/lib/agents/adversary/attack-chain";
import {
  getScenarioById,
  getSessionEvents,
  getTrainingSessionForUser,
} from "@/db/queries";
import type { scenarios, sessionEvents, trainingSessions } from "@/db/schema";
import { loadState } from "@/lib/agents/environment/session-store";
import type { VirtualHost } from "@/lib/agents/types";

export type SkillLevel = "struggling" | "on_track" | "advanced";

export type MentorContext = {
  scenario: typeof scenarios.$inferSelect;
  session: typeof trainingSessions.$inferSelect;
  recentCommands: string[];
  events: (typeof sessionEvents.$inferSelect)[];
  discoveredHosts: VirtualHost[];
  submittedFlags: string[];
  attackChain: AttackChain | null;
  skillLevel: SkillLevel;
  timeSpent: number;
  hintsGiven: number;
};

function extractCommandsFromEvents(
  events: (typeof sessionEvents.$inferSelect)[],
  limit: number,
): string[] {
  const cmds: string[] = [];
  for (let i = events.length - 1; i >= 0 && cmds.length < limit; i -= 1) {
    const e = events[i]!;
    if (e.eventType !== "milestone_reached") continue;
    const p = e.payload as { command?: string } | null;
    if (typeof p?.command === "string" && p.command.trim()) {
      cmds.unshift(p.command.trim());
    }
  }
  return cmds.slice(-limit);
}

function hostsMentionedInCommands(hosts: VirtualHost[], commands: string[]): VirtualHost[] {
  const found = new Set<string>();
  for (const cmd of commands) {
    const lower = cmd.toLowerCase();
    for (const h of hosts) {
      if (lower.includes(h.ip) || lower.includes(h.hostname.toLowerCase())) {
        found.add(h.id);
      }
    }
  }
  return hosts.filter((h) => found.has(h.id));
}

function countFlagCorrect(events: (typeof sessionEvents.$inferSelect)[]): number {
  let n = 0;
  const seen = new Set<string>();
  for (const e of events) {
    if (e.eventType !== "flag_correct") continue;
    const p = e.payload as { submitted?: string; duplicate?: boolean } | null;
    if (p?.duplicate) continue;
    const sub = p?.submitted;
    if (typeof sub === "string" && !seen.has(sub)) {
      seen.add(sub);
      n += 1;
    }
  }
  return n;
}

function countFailedCommands(events: (typeof sessionEvents.$inferSelect)[]): number {
  let n = 0;
  for (const e of events) {
    if (e.eventType !== "milestone_reached") continue;
    const p = e.payload as { exitCode?: number } | null;
    if (p && typeof p.exitCode === "number" && p.exitCode !== 0) n += 1;
  }
  return n;
}

export function calculateSkillLevel(
  events: (typeof sessionEvents.$inferSelect)[],
  timeSpentSeconds: number,
): SkillLevel {
  const correctFlags = countFlagCorrect(events);
  const failedCmds = countFailedCommands(events);

  if (correctFlags >= 2 && timeSpentSeconds < 600) {
    return "advanced";
  }
  if (
    (correctFlags < 2 && timeSpentSeconds > 900) ||
    (failedCmds >= 5 && correctFlags < 2)
  ) {
    return "struggling";
  }
  return "on_track";
}

function countHintsGiven(events: (typeof sessionEvents.$inferSelect)[]): number {
  return events.filter((e) => e.eventType === "hint_given").length;
}

/**
 * Rebuild mentor context from DB + in-memory environment (latest attack chain, topology).
 */
export async function buildContext(
  sessionId: number,
  userId: number,
): Promise<MentorContext | null> {
  const owned = await getTrainingSessionForUser(sessionId, userId);
  if (!owned?.scenario) return null;

  const scenario =
    (await getScenarioById(owned.scenarioId)) ??
    (owned.scenario as typeof scenarios.$inferSelect);

  const events = await getSessionEvents(sessionId);
  const recentCommands = extractCommandsFromEvents(events, 10);

  const payload = loadState(sessionId);
  const topology = payload?.topology;
  const discoveredHosts = topology
    ? hostsMentionedInCommands(topology.hosts, recentCommands)
    : [];

  const submitted: string[] = [];
  for (const e of events) {
    if (e.eventType === "flag_correct") {
      const p = e.payload as { submitted?: string } | null;
      if (typeof p?.submitted === "string") submitted.push(p.submitted);
    }
  }

  const started = owned.startedAt?.getTime() ?? owned.createdAt.getTime();
  const timeSpent = Math.max(0, Math.floor((Date.now() - started) / 1000));

  const skillLevel = calculateSkillLevel(events, timeSpent);
  const hintsGiven = countHintsGiven(events);

  return {
    scenario,
    session: owned as unknown as typeof trainingSessions.$inferSelect,
    recentCommands,
    events,
    discoveredHosts,
    submittedFlags: [...new Set(submitted)],
    attackChain: payload?.attackChain ?? null,
    skillLevel,
    timeSpent,
    hintsGiven,
  };
}

export function contextToPromptBlock(ctx: MentorContext): string {
  const lines = [
    `Scenario: ${ctx.scenario.name} (${ctx.scenario.difficulty})`,
    ctx.scenario.description.slice(0, 500),
    `Trainee skill estimate: ${ctx.skillLevel}`,
    `Time in session (approx): ${ctx.timeSpent}s`,
    `Hints given (session events): ${ctx.hintsGiven}`,
    `Correct flags so far: ${ctx.submittedFlags.length}`,
    `Recent commands: ${ctx.recentCommands.join(" | ") || "(none yet)"}`,
    `Hosts referenced in commands: ${ctx.discoveredHosts.map((h) => `${h.hostname}(${h.ip})`).join(", ") || "(none inferred)"}`,
  ];
  if (ctx.attackChain) {
    lines.push(
      `Attack chain status: ${ctx.attackChain.status}; steps completed: ${ctx.attackChain.steps.filter((s) => s.status === "completed").length}/${ctx.attackChain.steps.length}`,
    );
    const pending = ctx.attackChain.steps.find((s) => s.status === "pending");
    if (pending) {
      lines.push(
        `Next pending technique (do NOT reveal directly): ${pending.technique.id} — ${pending.technique.tactic}`,
      );
    }
  } else {
    lines.push("Attack chain: not planned or not loaded in this server process.");
  }
  return lines.join("\n");
}
