"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useElapsedSeconds } from "@/hooks/use-timer";
import type { ScoreBreakdown } from "@/lib/agents/evaluator/scoring";
import { toOverview } from "@/lib/agents/environment/overview";
import type { EnvironmentOverview } from "@/lib/agents/environment/overview";
import type { MentorResponse } from "@/lib/agents/mentor";
import type { CommandResult } from "@/lib/agents/types";
import type { NetworkTopology } from "@/lib/agents/types";
import type { SessionEventPayload } from "@/lib/websocket/client";
import { useTrainingSocket } from "@/lib/websocket/client";

export type SessionEventRow = SessionEventPayload;

export type InitialTrainingPayload = {
  sessionId: number;
  scenarioName: string;
  scenarioDifficulty: string;
  scenarioDescription: string;
  scenarioEstMinutes: number;
  status: string;
  finalScore: number | null;
  initialEvents: SessionEventRow[];
  initialOverview: EnvironmentOverview | null;
};

export interface UseTrainingSessionReturn {
  session: InitialTrainingPayload | null;
  environment: EnvironmentOverview | null;
  isLoading: boolean;
  isActive: boolean;
  isConnected: boolean;
  reconnectAttempt: number;
  elapsedTime: number;
  score: number;
  flagsFound: number;
  totalFlags: number;
  events: SessionEventRow[];
  hintsUsed: number;
  trainingStartedAt: number | null;
  setTrainingStartedAt: (t: number) => void;
  completedBreakdown: ScoreBreakdown | null;
  sendCommand: (cmd: string) => Promise<CommandResult>;
  submitFlag: (flag: string) => Promise<boolean>;
  abortSession: () => Promise<void>;
  finishSession: () => Promise<ScoreBreakdown>;
  refreshState: () => Promise<void>;
  sendMentorChat: (text: string) => Promise<MentorResponse>;
}

function sortEvents(rows: SessionEventRow[]): SessionEventRow[] {
  return [...rows].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function countFlagsFromEvents(events: SessionEventRow[]): number {
  const seen = new Set<string>();
  for (const e of events) {
    if (e.eventType !== "flag_correct") continue;
    const p = e.payload as { flagId?: string; duplicate?: boolean } | null;
    if (p?.duplicate) continue;
    const id = p?.flagId ?? `row-${e.id}`;
    seen.add(id);
  }
  return seen.size;
}

export function useTrainingSession(data: InitialTrainingPayload | null): UseTrainingSessionReturn {
  const sessionId = data?.sessionId ?? null;
  const { isConnected, reconnectAttempt, emitCommand, emitChat, onEvent } = useTrainingSocket(sessionId);

  const [events, setEvents] = useState<SessionEventRow[]>(() => sortEvents(data?.initialEvents ?? []));
  const [overview, setOverview] = useState<EnvironmentOverview | null>(data?.initialOverview ?? null);
  const [flagsFound, setFlagsFound] = useState(() => countFlagsFromEvents(data?.initialEvents ?? []));
  const [totalFlags, setTotalFlags] = useState(4);
  const [trainingStartedAt, setTrainingStartedAt] = useState<number | null>(null);
  const [completedBreakdown, setCompletedBreakdown] = useState<ScoreBreakdown | null>(null);
  const [sessionStatus, setSessionStatus] = useState(data?.status ?? "pending");

  useEffect(() => {
    if (!data) return;
    setEvents(sortEvents(data.initialEvents));
    setOverview(data.initialOverview);
    setFlagsFound(countFlagsFromEvents(data.initialEvents));
    setSessionStatus(data.status);
    setCompletedBreakdown(null);
  }, [data]);

  useEffect(() => {
    const unsub = onEvent("session_event", (ev) => {
      const row = ev as SessionEventPayload;
      setEvents((prev) => {
        if (prev.some((p) => p.id === row.id)) return prev;
        const next = sortEvents([...prev, row]);
        setFlagsFound(countFlagsFromEvents(next));
        return next;
      });
    });
    return unsub;
  }, [onEvent]);

  const hintsUsed = useMemo(
    () => events.filter((e) => e.eventType === "hint_requested" || e.eventType === "hint_given").length,
    [events],
  );

  const elapsedTime = useElapsedSeconds(trainingStartedAt);

  const score = useMemo(() => {
    const base = flagsFound * 18;
    const det = events.filter((e) => e.eventType === "attack_detected").length * 8;
    return Math.min(99, base + det);
  }, [flagsFound, events]);

  const isActive =
    sessionStatus === "running" || sessionStatus === "pending" || sessionStatus === "paused";

  const refreshState = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch(`/api/agents/environment/state?sessionId=${sessionId}`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const json = (await res.json()) as { topology?: NetworkTopology };
    if (json.topology) {
      setOverview(toOverview(json.topology));
    }
  }, [sessionId]);

  const sendCommand = useCallback(
    async (cmd: string): Promise<CommandResult> => {
      if (!sessionId) {
        return { exitCode: 1, stdout: "", stderr: "No session." };
      }

      if (isConnected) {
        const ack = await emitCommand(cmd);
        if (ack.ok) {
          if (ack.overview) setOverview(ack.overview);
          setFlagsFound(ack.flagsFound);
          if (ack.totalFlags > 0) setTotalFlags(ack.totalFlags);
          return ack.result;
        }
        if (ack.error !== "no_socket" && ack.error !== "timeout") {
          return {
            exitCode: 1,
            stdout: "",
            stderr: ack.message ?? ack.error ?? "Command rejected",
          };
        }
      }

      const res = await fetch("/api/agents/environment/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, command: cmd }),
      });
      const json = (await res.json()) as { result?: CommandResult; error?: string };
      if (!res.ok || !json.result) {
        return { exitCode: 1, stdout: "", stderr: json.error ?? "REST command failed" };
      }
      await refreshState();
      return json.result;
    },
    [sessionId, isConnected, emitCommand, refreshState],
  );

  const submitFlag = useCallback(
    async (flag: string): Promise<boolean> => {
      const trimmed = flag.trim();
      if (!trimmed) return false;
      const result = await sendCommand(`flag ${trimmed}`);
      const ok = result.exitCode === 0 && /correct|already/i.test(result.stdout);
      return ok;
    },
    [sendCommand],
  );

  const abortSession = useCallback(async () => {
    if (!sessionId) return;
    const res = await fetch("/api/training/abort", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sessionId }),
    });
    if (res.ok) {
      setSessionStatus("abandoned");
    }
  }, [sessionId]);

  const finishSession = useCallback(async (): Promise<ScoreBreakdown> => {
    if (!sessionId) {
      throw new Error("No session");
    }
    const res = await fetch("/api/training/finish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ sessionId }),
    });
    const json = (await res.json()) as { breakdown?: ScoreBreakdown; error?: string };
    if (!res.ok || !json.breakdown) {
      throw new Error(json.error ?? "Finish failed");
    }
    setCompletedBreakdown(json.breakdown);
    setSessionStatus("completed");
    return json.breakdown;
  }, [sessionId]);

  const sendMentorChat = useCallback(
    async (text: string): Promise<MentorResponse> => {
      if (isConnected && sessionId) {
        const ack = await emitChat(text);
        if (ack.ok) return ack.response;
      }
      const res = await fetch("/api/agents/mentor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, message: text }),
      });
      const json = (await res.json()) as MentorResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "Mentor chat failed");
      }
      return json;
    },
    [sessionId, isConnected, emitChat],
  );

  return {
    session: data,
    environment: overview,
    isLoading: false,
    isActive,
    isConnected,
    reconnectAttempt,
    elapsedTime,
    score,
    flagsFound,
    totalFlags,
    events,
    hintsUsed,
    trainingStartedAt,
    setTrainingStartedAt,
    completedBreakdown,
    sendCommand,
    submitFlag,
    abortSession,
    finishSession,
    refreshState,
    sendMentorChat,
  };
}
