"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type ActiveSessionCardProps = {
  sessionId: number;
  scenarioName: string;
  startedAt: Date | null;
  /** 0–100 progress estimate (e.g. from score or flags found). */
  progressPct: number;
};

function elapsedLabel(from: Date | null): string {
  if (!from) return "0:00";
  const sec = Math.max(0, Math.floor((Date.now() - from.getTime()) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function ActiveSessionCard({
  sessionId,
  scenarioName,
  startedAt,
  progressPct,
}: ActiveSessionCardProps) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Card className="border-emerald-500/30 bg-gradient-to-br from-slate-900 to-emerald-950/30">
      <CardHeader>
        <CardTitle className="text-base text-white">Active session</CardTitle>
        <p className="text-sm font-medium text-emerald-100">{scenarioName}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span>Elapsed</span>
          <span className="font-mono text-emerald-300">{elapsedLabel(startedAt)}</span>
        </div>
        <Progress value={progressPct} className="h-2 bg-slate-800 [&>div]:bg-emerald-500" />
      </CardContent>
      <CardFooter>
        <Button
          asChild
          className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
        >
          <Link href={`/dashboard/training/${sessionId}`}>Resume</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
