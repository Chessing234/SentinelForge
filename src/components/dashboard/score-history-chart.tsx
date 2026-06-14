"use client";

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import type { ScoreHistoryPoint } from "@/db/dashboard-queries";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  score: {
    label: "Score",
    color: "hsl(160 84% 39%)",
  },
} as const;

type ScoreHistoryChartProps = {
  data: ScoreHistoryPoint[];
};

export function ScoreHistoryChart({ data }: ScoreHistoryChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-900/40 text-sm text-slate-500">
        Complete training sessions to see score history.
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className="h-[280px] w-full">
      <LineChart data={data} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} className="stroke-slate-800" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fill: "hsl(215 16% 65%)", fontSize: 11 }}
        />
        <YAxis
          domain={[0, 100]}
          width={32}
          tickLine={false}
          axisLine={false}
          tick={{ fill: "hsl(215 16% 65%)", fontSize: 11 }}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          type="monotone"
          dataKey="score"
          stroke="hsl(160 84% 39%)"
          strokeWidth={2}
          dot={{ fill: "hsl(160 84% 39%)", r: 3 }}
        />
      </LineChart>
    </ChartContainer>
  );
}
