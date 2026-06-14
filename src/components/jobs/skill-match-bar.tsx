"use client";

import type { ReactElement } from "react";

import { cn } from "@/lib/utils";

export type SkillMatchRow = {
  key: string;
  label: string;
  required: number;
  actual: number;
};

type SkillMatchBarProps = {
  rows: SkillMatchRow[];
  className?: string;
};

export function SkillMatchBar({ rows, className }: SkillMatchBarProps): ReactElement {
  return (
    <div className={cn("space-y-4", className)}>
      {rows.map((row) => {
        const ratio = row.required <= 0 ? 1 : Math.min(1, row.actual / row.required);
        const pct = Math.round(ratio * 100);
        const tone =
          row.actual >= row.required
            ? "bg-emerald-500"
            : row.actual >= row.required * 0.85
              ? "bg-amber-400"
              : "bg-red-500";
        const markerPct = Math.min(100, row.required);
        return (
          <div key={row.key}>
            <div className="mb-1 flex justify-between text-xs text-slate-300">
              <span className="font-medium text-white">{row.label}</span>
              <span>
                <span className="text-slate-400">You:</span> {row.actual}{" "}
                <span className="text-slate-500">/</span>{" "}
                <span className="text-slate-400">Need:</span> {row.required}
              </span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className={cn("h-full rounded-full transition-all", tone)}
                style={{ width: `${Math.min(100, pct)}%` }}
              />
              <div
                className="pointer-events-none absolute top-0 h-full w-0.5 bg-white/90 shadow"
                style={{ left: `calc(${markerPct}% - 1px)` }}
                title="Required proficiency (0–100 scale)"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
