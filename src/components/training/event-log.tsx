"use client";

import type { ReactElement } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { SessionEventRow } from "@/hooks/use-training-session";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  CheckCircle2,
  Flag,
  Info,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

const FILTERS = [
  "all",
  "environment_ready",
  "attack_started",
  "attack_detected",
  "flag_submitted",
  "flag_correct",
  "flag_incorrect",
  "hint_requested",
  "session_completed",
  "milestone_reached",
] as const;

type Filter = (typeof FILTERS)[number];

function iconFor(type: string) {
  switch (type) {
    case "environment_ready":
      return Info;
    case "attack_started":
    case "attack_detected":
      return ShieldAlert;
    case "flag_correct":
      return CheckCircle2;
    case "flag_incorrect":
    case "flag_submitted":
      return Flag;
    case "hint_requested":
    case "hint_given":
      return Sparkles;
    case "session_completed":
      return CheckCircle2;
    default:
      return AlertTriangle;
  }
}

function tone(type: string): string {
  if (type.includes("flag_correct") || type === "environment_ready") return "text-emerald-400";
  if (type.includes("incorrect") || type === "attack_started") return "text-red-400";
  if (type.includes("hint")) return "text-amber-300";
  if (type === "attack_detected") return "text-amber-200";
  return "text-sky-300";
}

function describe(ev: SessionEventRow): string {
  const payload = ev.payload as Record<string, unknown> | null;

  switch (ev.eventType) {
    case "environment_ready":
      return "Environment provisioned";
    case "attack_started":
      return "Adversary attack chain planned";
    case "attack_detected":
      return "Trainee detected a technique";
    case "flag_submitted":
      return "Flag submission attempt";
    case "flag_correct":
      return "Correct flag captured";
    case "flag_incorrect":
      return "Incorrect flag";
    case "hint_requested":
      return "Hint requested";
    case "hint_given":
      return "Hint delivered";
    case "session_completed":
      return "Training finished";
    case "milestone_reached": {
      if (payload?.adversary === "step" && typeof payload.techniqueId === "string") {
        return `Adversary executed ${payload.techniqueId}`;
      }
      if (payload?.adversary === "detection_hypothesis") {
        return `Detection hypothesis scored ${String(payload.score ?? "?")}%`;
      }
      if (payload?.adversary === "detection_confirmed") {
        return "Detection confirmed by evaluator";
      }
      return "Training milestone reached";
    }
    default:
      return ev.eventType.replace(/_/g, " ");
  }
}

type EventLogProps = {
  events: SessionEventRow[];
};

export function EventLog({ events }: EventLogProps): ReactElement {
  const [filter, setFilter] = useState<Filter>("all");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    return events.filter((e) => e.eventType === filter);
  }, [events, filter]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filtered]);

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-800 bg-slate-950/60">
      <div className="border-b border-slate-800 px-3 py-2">
        <p className="text-xs font-medium text-slate-300">Event log</p>
        <select
          className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200"
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
        >
          {FILTERS.map((f) => (
            <option key={f} value={f}>
              {f === "all" ? "All types" : f.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      <ScrollArea className="min-h-0 flex-1 p-2">
        <ul className="space-y-2 pr-2 text-xs">
          {filtered.map((ev) => {
            const Icon = iconFor(ev.eventType);
            return (
              <li
                key={ev.id}
                className="flex gap-2 rounded-md border border-slate-800/80 bg-black/40 p-2"
              >
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone(ev.eventType)}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-200">{describe(ev)}</p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(ev.createdAt).toLocaleString()} · {ev.eventType}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        <div ref={bottomRef} />
      </ScrollArea>
    </div>
  );
}
