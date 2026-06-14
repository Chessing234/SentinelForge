import { createHash } from "node:crypto";

import { createSessionEvent } from "@/db/queries";
import type { NetworkTopology } from "@/lib/agents/types";

export type SessionFlag = {
  id: string;
  value: string;
  label: string;
  hiddenPath: string;
  hiddenHostId: string;
  found: boolean;
};

export type FlagSubmissionResult = {
  correct: boolean;
  message: string;
};

function normalizeFlag(s: string): string {
  return s.trim();
}

export function generateSessionFlags(params: {
  sessionId: number;
  scenarioId: number;
  topology: NetworkTopology;
  count: number;
}): SessionFlag[] {
  const candidates: { hostId: string; path: string }[] = [];
  for (const h of params.topology.hosts) {
    for (const f of h.files) {
      if (f.path.startsWith("/etc/passwd")) continue;
      candidates.push({ hostId: h.id, path: f.path });
    }
  }
  if (candidates.length === 0) {
    for (const h of params.topology.hosts) {
      candidates.push({ hostId: h.id, path: "/tmp/artifact.txt" });
    }
  }

  const flags: SessionFlag[] = [];
  const n = Math.max(3, Math.min(5, params.count));
  for (let i = 0; i < n; i += 1) {
    const body = createHash("sha256")
      .update(`sf|${params.sessionId}|${params.scenarioId}|${i}|v1`)
      .digest("base64url")
      .slice(0, 22);
    const value = `SF{${body}}`;
    const placement = candidates[i % candidates.length]!;
    flags.push({
      id: `flag-${i + 1}`,
      value,
      label: `Evidence token ${i + 1}`,
      hiddenPath: placement.path,
      hiddenHostId: placement.hostId,
      found: false,
    });
  }
  return flags;
}

export function embedFlagsInTopology(
  topology: NetworkTopology,
  flags: SessionFlag[],
): NetworkTopology {
  for (const flag of flags) {
    const host = topology.hosts.find((h) => h.id === flag.hiddenHostId);
    if (!host) continue;
    const file = host.files.find((f) => f.path === flag.hiddenPath);
    const line = `\n# sentinel-forge evidence\nFLAG_${flag.id}=${flag.value}\n`;
    if (file) {
      file.content = `${file.content ?? ""}${line}`;
      file.suspicious = true;
    } else {
      host.files.push({
        path: flag.hiddenPath,
        name: flag.hiddenPath.split("/").pop() ?? "artifact",
        size: line.length,
        permissions: "-rw-r--r--",
        suspicious: true,
        content: line,
      });
    }
  }
  return topology;
}

export async function verifyFlag(params: {
  sessionId: number;
  submitted: string;
  flags: SessionFlag[];
}): Promise<FlagSubmissionResult> {
  const submitted = normalizeFlag(params.submitted);
  const match = params.flags.find((f) => f.value === submitted);

  await createSessionEvent({
    sessionId: params.sessionId,
    eventType: "flag_submitted",
    payload: { submitted },
  });

  if (!match) {
    await createSessionEvent({
      sessionId: params.sessionId,
      eventType: "flag_incorrect",
      payload: { submitted },
    });
    return { correct: false, message: "Incorrect flag." };
  }

  if (match.found) {
    await createSessionEvent({
      sessionId: params.sessionId,
      eventType: "flag_correct",
      payload: { submitted, flagId: match.id, duplicate: true },
    });
    return { correct: true, message: "Flag already submitted (duplicate)." };
  }

  match.found = true;
  await createSessionEvent({
    sessionId: params.sessionId,
    eventType: "flag_correct",
    payload: { submitted, flagId: match.id },
  });
  const m = /^flag-(\d+)$/i.exec(match.id);
  const flagNumber = m ? Number(m[1]) : params.flags.filter((f) => f.found).length;
  const { slackNotificationService } = await import("@/lib/slack/notifications");
  void slackNotificationService.notifyFlagFound(params.sessionId, flagNumber).catch(() => undefined);
  return { correct: true, message: `Correct! ${match.label} captured.` };
}
