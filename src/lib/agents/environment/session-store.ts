import type { NetworkTopology } from "@/lib/agents/types";

import type { SessionFlag } from "@/lib/agents/environment/flags";
import type { AttackChain } from "@/lib/agents/adversary/attack-chain";

const TTL_MS = 4 * 60 * 60 * 1000;

export type DetectionRecord = {
  submitted: string;
  scorePercent: number;
  at: string;
};

/** Tracks which hint levels were used per attack step (or "general"). */
export type MentorHintState = {
  hintLevelsByStep: Record<string, number[]>;
};

export type StoredEnvironmentPayload = {
  topology: NetworkTopology;
  flags: SessionFlag[];
  /** Optional per-host fake process listings for ps/top */
  processListings: Record<string, string>;
  /** Optional netstat output per host */
  netstatListings: Record<string, string>;
  scenarioId: number;
  difficulty: string;
  expiresAt: number;
  attackChain?: AttackChain;
  detectionHistory?: DetectionRecord[];
  mentorState?: MentorHintState;
};

const memory = new Map<number, StoredEnvironmentPayload>();

export function saveState(sessionId: number, payload: StoredEnvironmentPayload): void {
  memory.set(sessionId, payload);
}

export function loadState(sessionId: number): StoredEnvironmentPayload | null {
  const row = memory.get(sessionId);
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    memory.delete(sessionId);
    return null;
  }
  return row;
}

export function deleteState(sessionId: number): void {
  memory.delete(sessionId);
}

export function touchExpiry(sessionId: number): void {
  const row = memory.get(sessionId);
  if (!row) return;
  row.expiresAt = Date.now() + TTL_MS;
}

export function createPayload(
  topology: NetworkTopology,
  flags: SessionFlag[],
  scenarioId: number,
  difficulty: string,
): StoredEnvironmentPayload {
  const processListings: Record<string, string> = {};
  const netstatListings: Record<string, string> = {};
  for (const h of topology.hosts) {
    processListings[h.id] = buildPsOutput(h);
    netstatListings[h.id] = buildNetstatOutput(h);
  }
  return {
    topology,
    flags,
    processListings,
    netstatListings,
    scenarioId,
    difficulty,
    expiresAt: Date.now() + TTL_MS,
    mentorState: { hintLevelsByStep: {} },
  };
}

function buildPsOutput(host: { hostname: string; services: { name: string; port: number }[] }): string {
  const lines = [
    "USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND",
    "root         1  0.0  0.1  16896  8192 ?        Ss   Mar10   0:12 /sbin/init",
    "root       412  0.0  0.0  11208  3584 ?        Ss   Mar10   0:04 /usr/sbin/sshd -D",
  ];
  let pid = 500;
  for (const s of host.services) {
    pid += 17;
    const sus = s.port === 8080 || s.name === "HTTP";
    lines.push(
      `www-data  ${pid}  0.1  0.4  204800 45056 ?      S${sus ? "<" : " "}   Mar11   0:${sus ? "42" : "02"} nginx: worker process`,
    );
  }
  if (host.hostname.includes("sandbox")) {
    lines.push("user2000  9001  4.2  1.1  882000 120000 ?     Sl   09:15   1:22 ./sample.bin --persist");
  }
  return `${lines.join("\n")}\n`;
}

function buildNetstatOutput(host: { ip: string; services: { port: number; name: string }[] }): string {
  const rows = ["Proto Recv-Q Send-Q Local Address           Foreign Address         State"];
  for (const s of host.services) {
    rows.push(
      `tcp        0      0 ${host.ip}:${s.port}           0.0.0.0:*               LISTEN`,
    );
  }
  rows.push(`tcp        0      0 ${host.ip}:49832         203.0.113.44:443        ESTABLISHED`);
  return `${rows.join("\n")}\n`;
}

/** Stub for future Redis adapter (same interface). */
export const redisAdapterStub = {
  async save(sessionId: number, serialized: string): Promise<void> {
    void sessionId;
    void serialized;
  },
  async load(sessionId: number): Promise<string | null> {
    void sessionId;
    return null;
  },
};
