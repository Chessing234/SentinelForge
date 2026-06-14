"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
} from "recharts";

import type { CategoryRadarPoint } from "@/db/dashboard-queries";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

const chartConfig = {
  score: {
    label: "Avg score",
    color: "hsl(160 84% 39%)",
  },
} as const;

type SkillRadarChartProps = {
  data: CategoryRadarPoint[];
};

export function SkillRadarChart({ data }: SkillRadarChartProps) {
  const chartData = data.map((d) => ({
    category: d.label,
    score: d.score,
  }));

  return (
    <ChartContainer
      config={chartConfig}
      className="mx-auto aspect-square w-full max-w-md md:max-w-none"
    >
      <RadarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <PolarGrid className="stroke-slate-700" />
        <PolarAngleAxis dataKey="category" tick={{ fill: "hsl(215 16% 65%)", fontSize: 11 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
        <Radar
          name="score"
          dataKey="score"
          fill="hsl(160 84% 39%)"
          fillOpacity={0.2}
          stroke="hsl(160 84% 39%)"
          strokeWidth={2}
        />
      </RadarChart>
    </ChartContainer>
  );
}
