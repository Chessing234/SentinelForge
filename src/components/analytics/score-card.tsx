"use client";

import type { ReactElement } from "react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { ScoreGrade } from "@/lib/agents/evaluator/scoring";

type ScoreCardProps = {
  score: number;
};

function gradeFromTotal(n: number): ScoreGrade {
  if (n >= 95) return "S";
  if (n >= 85) return "A";
  if (n >= 75) return "B";
  if (n >= 65) return "C";
  if (n >= 50) return "D";
  return "F";
}

const gradeColor: Record<ScoreGrade, string> = {
  S: "text-amber-300",
  A: "text-emerald-400",
  B: "text-sky-400",
  C: "text-amber-400",
  D: "text-orange-400",
  F: "text-red-400",
};

const ringColor: Record<ScoreGrade, string> = {
  S: "stroke-amber-300",
  A: "stroke-emerald-400",
  B: "stroke-sky-400",
  C: "stroke-amber-400",
  D: "stroke-orange-400",
  F: "stroke-red-400",
};

export function ScoreCard({ score }: ScoreCardProps): ReactElement {
  const grade = gradeFromTotal(score);
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    setPulse(true);
    const t = setTimeout(() => setPulse(false), 900);
    return () => clearTimeout(t);
  }, [score, grade]);

  const pct = Math.min(100, Math.max(0, score));
  const dash = `${(pct / 100) * 251.2} 251.2`;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 px-6 py-8">
      <div className={cn("relative flex h-36 w-36 items-center justify-center", pulse && "animate-pulse")}>
        <svg className="absolute h-full w-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            className="stroke-slate-800"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            className={cn("transition-all duration-700", ringColor[grade])}
            strokeWidth="8"
            strokeDasharray={dash}
            strokeLinecap="round"
          />
        </svg>
        <div className="relative z-10 text-center">
          <p className={cn("text-3xl font-bold tabular-nums", gradeColor[grade])}>{score}</p>
          <p className={cn("text-2xl font-black", gradeColor[grade])}>{grade}</p>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">Latest session composite</p>
    </div>
  );
}
