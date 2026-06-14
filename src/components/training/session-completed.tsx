"use client";

import type { ReactElement } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ScoreBreakdown } from "@/lib/agents/evaluator/scoring";
import Link from "next/link";

type SessionCompletedProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  breakdown: ScoreBreakdown | null;
  flagsFound: number;
  totalFlags: number;
};

function gradeColor(grade: string): string {
  switch (grade) {
    case "S":
      return "text-amber-300";
    case "A":
      return "text-emerald-400";
    case "B":
      return "text-sky-400";
    case "C":
      return "text-amber-400";
    case "D":
      return "text-orange-400";
    default:
      return "text-red-400";
  }
}

export function SessionCompletedModal({
  open,
  onOpenChange,
  breakdown,
  flagsFound,
  totalFlags,
}: SessionCompletedProps): ReactElement {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!open || !breakdown) {
      setDisplay(0);
      return;
    }
    const target = breakdown.totalScore;
    let frame = 0;
    const id = window.setInterval(() => {
      frame += 1;
      setDisplay(Math.min(target, Math.round((target * frame) / 20)));
      if (frame >= 20) window.clearInterval(id);
    }, 40);
    return () => window.clearInterval(id);
  }, [open, breakdown]);

  if (!breakdown) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="border-slate-800 bg-slate-950 text-white" />
      </Dialog>
    );
  }

  const share = async () => {
    const text = `SentinelForge lab — Score ${breakdown.totalScore} (${breakdown.grade}). Detection ${breakdown.detectionScore}, Analysis ${breakdown.analysisScore}, Response ${breakdown.responseScore}, Speed ${breakdown.speedScore}. Time ${breakdown.timeSpent}s, hints ${breakdown.hintsUsed}.`;
    await navigator.clipboard.writeText(text);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-800 bg-slate-950 text-slate-100">
        <DialogHeader>
          <DialogTitle className="text-xl text-white">Session complete</DialogTitle>
          <DialogDescription className="text-slate-400">
            Performance summary for this training run.
          </DialogDescription>
        </DialogHeader>

        {breakdown.grade === "S" || breakdown.grade === "A" ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className="absolute h-2 w-2 animate-ping rounded-full bg-emerald-400/40"
                style={{
                  left: `${(i * 73) % 100}%`,
                  top: `${(i * 41) % 80}%`,
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        ) : null}

        <div className="relative space-y-4 py-2">
          <div className="flex items-end gap-4">
            <p className="text-5xl font-bold text-white">{display}</p>
            <span className={`text-4xl font-black ${gradeColor(breakdown.grade)}`}>{breakdown.grade}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <Stat label="Detection" value={breakdown.detectionScore} />
            <Stat label="Analysis" value={breakdown.analysisScore} />
            <Stat label="Response" value={breakdown.responseScore} />
            <Stat label="Speed" value={breakdown.speedScore} />
          </div>
          <div className="text-xs text-slate-400">
            <p>
              Flags: {flagsFound} / {totalFlags} · Time {breakdown.timeSpent}s · Hints{" "}
              {breakdown.hintsUsed} (included in scoring)
            </p>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" className="border-slate-600" onClick={() => void share()}>
            Share results
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" asChild>
              <Link href="/dashboard/progress">View detailed report</Link>
            </Button>
            <Button type="button" className="bg-emerald-600 hover:bg-emerald-500" asChild>
              <Link href="/dashboard/scenarios">Try another scenario</Link>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: number }): ReactElement {
  return (
    <div className="rounded border border-slate-800 bg-black/40 p-2">
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className="font-mono text-lg text-emerald-300">{value}</p>
    </div>
  );
}
