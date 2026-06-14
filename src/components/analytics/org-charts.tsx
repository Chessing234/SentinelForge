"use client";

import type { ReactElement } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { CategoryScore, WeekData } from "@/lib/agents/evaluator/analytics";

type OrgChartsProps = {
  weeklyActivity: WeekData[];
  categoryBreakdown: CategoryScore[];
};

export function OrgCharts({ weeklyActivity, categoryBreakdown }: OrgChartsProps): ReactElement {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-lg border border-slate-800 bg-slate-900/50">
        <div className="border-b border-slate-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Weekly activity</h2>
        </div>
        <div className="h-72 p-6 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyActivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="weekStart" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155" }}
                labelStyle={{ color: "#e2e8f0" }}
              />
              <Bar dataKey="sessions" fill="#34d399" radius={[4, 4, 0, 0]} name="Sessions" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900/50">
        <div className="border-b border-slate-800 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Category performance</h2>
        </div>
        <div className="h-72 p-6 pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={categoryBreakdown} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis
                type="category"
                dataKey="category"
                width={120}
                tick={{ fill: "#94a3b8", fontSize: 10 }}
                tickFormatter={(v: string) => v.replace(/_/g, " ")}
              />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #334155" }}
                labelStyle={{ color: "#e2e8f0" }}
              />
              <Bar dataKey="averageScore" fill="#38bdf8" radius={[0, 4, 4, 0]} name="Avg score" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
