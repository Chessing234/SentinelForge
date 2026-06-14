"use client";

import Link from "next/link";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type UsageMeterProps = {
  organizationName: string;
  seatsUsed: number;
  seatLimit: number;
  scenariosCompletedThisMonth: number;
  activeUsersThisMonth: number;
  billingCycleLabel?: string;
};

export function UsageMeter({
  organizationName,
  seatsUsed,
  seatLimit,
  scenariosCompletedThisMonth,
  activeUsersThisMonth,
  billingCycleLabel = "Calendar month (UTC)",
}: UsageMeterProps): ReactElement {
  const pct = seatLimit > 0 ? Math.min(100, Math.round((seatsUsed / seatLimit) * 100)) : 0;
  const nearLimit = pct >= 85;

  return (
    <Card className="border-slate-800 bg-slate-950/80">
      <CardHeader>
        <CardTitle className="text-white">Usage — {organizationName}</CardTitle>
        <CardDescription className="text-slate-400">{billingCycleLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="mb-1 flex justify-between text-sm text-slate-300">
            <span>Seats</span>
            <span>
              {seatsUsed} / {seatLimit}
            </span>
          </div>
          <Progress value={pct} className="h-2 bg-slate-800" />
          {nearLimit ? (
            <p className="mt-2 text-xs text-amber-400">
              You are approaching your seat limit. Consider upgrading your plan.
            </p>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Scenarios completed</p>
            <p className="text-2xl font-semibold text-white">{scenariosCompletedThisMonth}</p>
            <p className="text-xs text-slate-500">this month</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Active users</p>
            <p className="text-2xl font-semibold text-white">{activeUsersThisMonth}</p>
            <p className="text-xs text-slate-500">trained this month</p>
          </div>
        </div>
        {nearLimit ? (
          <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
            <Link href="/dashboard/billing">Upgrade plan</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
