"use client";

import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { AttackChain, AttackStep } from "@/lib/agents/adversary/attack-chain";
import { CheckCircle2, Circle, Loader2, ShieldAlert } from "lucide-react";

type AttackTimelineProps = {
  sessionId: number;
  initialChain?: AttackChain | null;
  isActive: boolean;
};

function statusLabel(status: AttackChain["status"]): string {
  switch (status) {
    case "planned":
      return "Planned";
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    case "detected":
      return "Detected";
    default:
      return status;
  }
}

function statusBadgeClass(status: AttackChain["status"]): string {
  switch (status) {
    case "completed":
      return "bg-emerald-500/15 text-emerald-300";
    case "in_progress":
      return "bg-amber-500/15 text-amber-300";
    case "detected":
      return "bg-sky-500/15 text-sky-300";
    default:
      return "bg-red-500/15 text-red-300";
  }
}

function StepIcon({ step }: { step: AttackStep }): ReactElement {
  if (step.status === "completed") {
    return <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />;
  }
  if (step.status === "executing") {
    return <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-amber-400" aria-hidden />;
  }
  return <Circle className="h-3.5 w-3.5 shrink-0 text-slate-600" aria-hidden />;
}

export function AttackTimeline({
  sessionId,
  initialChain = null,
  isActive,
}: AttackTimelineProps): ReactElement {
  const [chain, setChain] = useState<AttackChain | null>(initialChain);
  const [loading, setLoading] = useState(!initialChain);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/agents/adversary/status?sessionId=${sessionId}`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const json = (await res.json()) as { chain?: AttackChain };
      if (json.chain) setChain(json.chain);
    } catch {
      /* ignore poll errors */
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void refresh();
    if (!isActive) return;
    const id = window.setInterval(() => void refresh(), 4000);
    return () => window.clearInterval(id);
  }, [refresh, isActive]);

  if (loading && !chain) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
        <p className="text-xs text-slate-500">Loading adversary timeline…</p>
      </div>
    );
  }

  if (!chain) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
        <p className="text-xs text-slate-500">No attack chain for this session.</p>
      </div>
    );
  }

  const completed = chain.steps.filter((s) => s.status === "completed").length;

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-red-900/40 bg-slate-950/60">
      <div className="border-b border-slate-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5 text-red-400" aria-hidden />
          <p className="text-xs font-medium text-slate-200">Adversary timeline</p>
        </div>
        <p className="mt-0.5 truncate text-[10px] text-slate-500">{chain.name}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusBadgeClass(chain.status)}`}
          >
            {statusLabel(chain.status)}
          </span>
          <span className="text-[10px] text-slate-500">
            {completed}/{chain.steps.length} techniques · MITRE ATT&CK
          </span>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1 p-2">
        <ol className="space-y-1.5 pr-2">
          {chain.steps.map((step, idx) => (
            <li
              key={step.id}
              className="flex gap-2 rounded-md border border-slate-800/80 bg-black/30 p-2 text-[11px]"
            >
              <StepIcon step={step} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-200">
                  {idx + 1}. {step.technique.name}
                </p>
                <p className="text-[10px] text-red-400/90">{step.technique.id}</p>
                <p className="text-[10px] text-slate-500">{step.technique.tactic}</p>
                {step.status === "completed" && step.artifacts.length > 0 ? (
                  <p className="mt-0.5 text-[10px] text-amber-300/90">
                    {step.artifacts.length} artifact{step.artifacts.length === 1 ? "" : "s"} in lab
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </ScrollArea>
    </div>
  );
}
