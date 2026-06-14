"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatsCardProps = {
  label: string;
  value: number;
  icon: LucideIcon;
  format?: "number" | "percent" | "decimal";
  /** When set, skips count-up and shows this string (e.g. rank "—"). */
  valueLabel?: string;
  trend?: {
    direction: "up" | "down" | "flat";
    pct: number;
  };
  footer?: ReactNode;
};

function formatValue(value: number, format: StatsCardProps["format"]): string {
  if (format === "percent") return `${Math.round(value)}%`;
  if (format === "decimal") return value.toFixed(1);
  return value.toLocaleString();
}

export function StatsCard({
  label,
  value,
  icon: Icon,
  format = "number",
  valueLabel,
  trend,
  footer,
}: StatsCardProps): ReactElement {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (valueLabel !== undefined) return;
    const duration = 800;
    const start = performance.now();
    const from = 0;
    const to = value;
    let frame: number;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + (to - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, valueLabel]);

  const mainDisplay =
    valueLabel !== undefined ? valueLabel : formatValue(display, format);

  return (
    <Card className="border-slate-800 bg-slate-900/50 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-slate-400">{label}</CardTitle>
        <Icon className="h-4 w-4 text-emerald-500" aria-hidden />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tracking-tight text-white">{mainDisplay}</div>
        {trend ? (
          <p
            className={cn(
              "mt-1 flex items-center gap-1 text-xs font-medium",
              trend.direction === "up" && "text-emerald-400",
              trend.direction === "down" && "text-red-400",
              trend.direction === "flat" && "text-slate-500",
            )}
          >
            {trend.direction === "up" ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : null}
            {trend.direction === "down" ? (
              <ArrowDownRight className="h-3.5 w-3.5" />
            ) : null}
            {trend.direction === "flat" ? <Minus className="h-3.5 w-3.5" /> : null}
            {trend.direction === "flat" ? "Stable" : `${Math.abs(trend.pct)}%`}{" "}
            {trend.direction !== "flat" ? "vs prior 30 days" : ""}
          </p>
        ) : null}
        {footer}
      </CardContent>
    </Card>
  );
}
