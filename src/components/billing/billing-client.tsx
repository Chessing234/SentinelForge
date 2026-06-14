"use client";

import type { LucideIcon } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";

import { PlanCard, type PlanId } from "@/components/billing/plan-card";
import { Button } from "@/components/ui/button";

type PlanDef = {
  plan: PlanId;
  title: string;
  description: string;
  monthlyPriceUsd: number | null;
  annualPriceUsd: number | null;
  features: string[];
  icon: LucideIcon;
};

type BillingClientProps = {
  currentPlan: PlanId;
  plans: PlanDef[];
};

export function BillingClient({ currentPlan, plans }: BillingClientProps): ReactElement {
  const [message, setMessage] = useState<string | null>(null);

  async function openPortal(): Promise<void> {
    setMessage(null);
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const json = (await res.json()) as { url?: string; error?: string };
    if (!res.ok) {
      setMessage(json.error ?? "Could not open billing portal");
      return;
    }
    if (json.url) {
      window.location.href = json.url;
    }
  }

  async function checkout(
    plan: "academic" | "enterprise",
    seats: number,
    billing: "monthly" | "annual",
  ): Promise<void> {
    setMessage(null);
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan, seats, billing }),
    });
    const json = (await res.json()) as { url?: string; error?: { message?: string } };
    if (!res.ok) {
      setMessage(json.error?.message ?? "Checkout failed");
      return;
    }
    if (json.url) {
      window.location.href = json.url;
    }
  }

  return (
    <div className="space-y-4">
      {message ? <p className="text-sm text-amber-400">{message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="border-slate-600" onClick={() => void openPortal()}>
          Open customer portal
        </Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {plans.map((p) => (
          <PlanCard
            key={p.plan}
            plan={p.plan}
            title={p.title}
            description={p.description}
            monthlyPriceUsd={p.monthlyPriceUsd}
            annualPriceUsd={p.annualPriceUsd}
            features={p.features}
            icon={p.icon}
            currentPlan={currentPlan}
            onUpgrade={p.plan === "free" ? undefined : checkout}
          />
        ))}
      </div>
    </div>
  );
}
