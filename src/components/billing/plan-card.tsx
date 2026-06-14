"use client";

import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type PlanId = "free" | "academic" | "enterprise";

type PlanCardProps = {
  plan: PlanId;
  title: string;
  description: string;
  monthlyPriceUsd: number | null;
  annualPriceUsd: number | null;
  features: string[];
  icon: LucideIcon;
  currentPlan: PlanId;
  onUpgrade?: (plan: "academic" | "enterprise", seats: number, billing: "monthly" | "annual") => void;
  defaultSeats?: number;
};

const order: PlanId[] = ["free", "academic", "enterprise"];

export function PlanCard({
  plan,
  title,
  description,
  monthlyPriceUsd,
  annualPriceUsd,
  features,
  icon: Icon,
  currentPlan,
  onUpgrade,
  defaultSeats = 10,
}: PlanCardProps): ReactElement {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [seats, setSeats] = useState(defaultSeats);
  const currentIdx = order.indexOf(currentPlan);
  const thisIdx = order.indexOf(plan);
  const isCurrent = plan === currentPlan;
  const isUpgrade = thisIdx > currentIdx;
  const isDowngrade = thisIdx < currentIdx;

  const price =
    plan === "free"
      ? 0
      : billing === "monthly"
        ? (monthlyPriceUsd ?? 0)
        : (annualPriceUsd ?? monthlyPriceUsd ?? 0);

  return (
    <Card
      className={cn(
        "flex flex-col border-slate-800 bg-slate-950/80",
        isCurrent && "ring-2 ring-emerald-500/60",
      )}
    >
      <CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-emerald-400" aria-hidden />
          <CardTitle className="text-lg text-white">{title}</CardTitle>
        </div>
        <CardDescription className="text-slate-400">{description}</CardDescription>
        {plan !== "free" ? (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium",
                billing === "monthly" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300",
              )}
              onClick={() => setBilling("monthly")}
            >
              Monthly
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium",
                billing === "annual" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300",
              )}
              onClick={() => setBilling("annual")}
            >
              Annual
            </button>
          </div>
        ) : null}
        <p className="mt-2 text-2xl font-semibold text-white">
          {plan === "free" ? "$0" : `$${price}`}
          {plan !== "free" ? (
            <span className="text-sm font-normal text-slate-400">
              {" "}
              / seat / {billing === "monthly" ? "mo" : "yr"}
            </span>
          ) : null}
        </p>
      </CardHeader>
      <CardContent className="flex-1 space-y-2">
        <ul className="space-y-2 text-sm text-slate-300">
          {features.map((f) => (
            <li key={f} className="flex gap-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        {plan !== "free" && onUpgrade ? (
          <label className="mt-4 block text-xs text-slate-400">
            Seats
            <input
              type="number"
              min={1}
              max={5000}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-white"
              value={seats}
              onChange={(e) => setSeats(Number(e.target.value))}
            />
          </label>
        ) : null}
      </CardContent>
      <CardFooter className="flex-col gap-2 border-t border-slate-800 pt-4">
        {isCurrent ? (
          <Button type="button" variant="secondary" className="w-full" disabled>
            Current plan
          </Button>
        ) : plan === "free" && isDowngrade ? (
          <Button type="button" variant="outline" className="w-full border-slate-600" disabled>
            Downgrade via portal
          </Button>
        ) : plan !== "free" && isUpgrade && onUpgrade ? (
          <Button
            type="button"
            className="w-full bg-emerald-600 hover:bg-emerald-500"
            onClick={() => onUpgrade(plan, seats, billing)}
          >
            Upgrade
          </Button>
        ) : (
          <Button type="button" variant="outline" className="w-full border-slate-600" disabled>
            Contact sales
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
