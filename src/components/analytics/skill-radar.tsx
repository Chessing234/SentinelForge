"use client";

import type { ReactElement } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

import type { CategoryRadarPoint } from "@/db/dashboard-queries";

type SkillRadarProps = {
  data: CategoryRadarPoint[];
};

const BENCH = 75;

export function SkillRadar({ data }: SkillRadarProps): ReactElement {
  const chartData = data.map((d) => ({
    subject: d.label,
    score: d.score,
    benchmark: BENCH,
  }));

  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-slate-700 text-sm text-slate-500">
        No category scores yet.
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }}
            labelStyle={{ color: "#e2e8f0" }}
          />
          <Radar
            name="Benchmark"
            dataKey="benchmark"
            stroke="#64748b"
            fill="#64748b"
            fillOpacity={0.08}
            strokeWidth={1}
          />
          <Radar
            name="Your score"
            dataKey="score"
            stroke="#34d399"
            fill="#34d399"
            fillOpacity={0.35}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-center text-xs text-slate-500">
        Gray ring = recommended baseline ({BENCH}). Emerald = your average per category.
      </p>
    </div>
  );
}
