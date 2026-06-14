import { getSessionById, updateSession } from "@/db/queries";
import type { CommandResult, NetworkTopology } from "@/lib/agents/types";
import { executeRawCommand } from "@/lib/agents/environment/command-executor";
import { parseCommand, validateSyntax } from "@/lib/agents/environment/command-parser";
import {
  embedFlagsInTopology,
  generateSessionFlags,
  verifyFlag,
} from "@/lib/agents/environment/flags";
import { generateEnvironment } from "@/lib/agents/environment/generator";
import {
  createPayload,
  loadState,
  saveState,
  touchExpiry,
} from "@/lib/agents/environment/session-store";
import { toOverview, type EnvironmentOverview } from "@/lib/agents/environment/overview";

export { toOverview, type EnvironmentOverview };

export class EnvironmentAgent {
  async initialize(sessionId: number): Promise<{ topology: NetworkTopology; overview: EnvironmentOverview }> {
    const row = await getSessionById(sessionId);
    if (!row?.scenario) {
      throw new Error(`Training session ${sessionId} not found`);
    }

    const topology = await generateEnvironment(
      row.scenarioId,
      row.scenario.difficulty,
      sessionId,
    );

    const flags = generateSessionFlags({
      sessionId,
      scenarioId: row.scenarioId,
      topology,
      count: 4,
    });

    embedFlagsInTopology(topology, flags);
    const payload = createPayload(topology, flags, row.scenarioId, row.scenario.difficulty);
    saveState(sessionId, payload);

    const overview = toOverview(topology);
    await updateSession(sessionId, {
      status: "running",
      startedAt: new Date(),
      environmentState: overview as unknown as Record<string, unknown>,
    });

    return { topology, overview };
  }

  async getState(sessionId: number): Promise<NetworkTopology | null> {
    const payload = loadState(sessionId);
    touchExpiry(sessionId);
    return payload?.topology ?? null;
  }

  async getOverview(sessionId: number): Promise<EnvironmentOverview | null> {
    const payload = loadState(sessionId);
    if (!payload) return null;
    return toOverview(payload.topology);
  }

  async executeCommand(sessionId: number, command: string): Promise<CommandResult> {
    const payload = loadState(sessionId);
    if (!payload) {
      return { exitCode: 1, stdout: "", stderr: "No active environment for this session." };
    }
    touchExpiry(sessionId);

    const parsed = parseCommand(command);
    if (parsed.kind === "flag") {
      const v = validateSyntax(parsed);
      if (!v.ok) {
        return { exitCode: 2, stdout: "", stderr: v.error ?? "Invalid flag" };
      }
      const result = await verifyFlag({
        sessionId,
        submitted: parsed.value,
        flags: payload.flags,
      });
      saveState(sessionId, payload);
      return {
        exitCode: result.correct ? 0 : 1,
        stdout: result.message + "\n",
        stderr: "",
      };
    }

    if (
      parsed.kind === "shell" &&
      parsed.program === "echo" &&
      parsed.args.join(" ").includes("usage: flag")
    ) {
      return { exitCode: 2, stdout: parsed.args.join(" ") + "\n", stderr: "" };
    }

    return executeRawCommand(payload, command, parsed);
  }

  async compromiseHost(sessionId: number, hostId: string): Promise<void> {
    const payload = loadState(sessionId);
    if (!payload) return;
    const host = payload.topology.hosts.find((h) => h.id === hostId);
    if (host) {
      host.isCompromised = true;
    }
    saveState(sessionId, payload);
  }

  async getHint(sessionId: number, hintLevel: number): Promise<string> {
    const payload = loadState(sessionId);
    if (!payload) {
      return "No environment loaded yet.";
    }
    const t = payload.topology;
    if (hintLevel <= 1) {
      return `There are ${t.hosts.length} hosts in scope across ${t.subnet}. Start with a ping sweep or nmap on the lab subnet.`;
    }
    if (hintLevel === 2) {
      const ports = [...new Set(t.hosts.flatMap((h) => h.services.map((s) => s.port)))].sort(
        (a, b) => a - b,
      );
      return `Open services across the lab include ports: ${ports.join(", ")}.`;
    }
    const weak = t.hosts.flatMap((h) =>
      h.users.filter((u) => u.hasWeakPassword).map((u) => `${u.username}@${h.ip}`),
    );
    return `Credential hint: try common lab passwords on ${weak.join(" ; ") || "discovered accounts"}.`;
  }
}

export const environmentAgent = new EnvironmentAgent();
