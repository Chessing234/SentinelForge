import type { Metadata } from "next";
import { GraduationCap, Rocket, Shield } from "lucide-react";
import type { ReactElement } from "react";

import { BillingClient } from "@/components/billing/billing-client";
import { UsageMeter } from "@/components/billing/usage-meter";
import { auth } from "@/auth";
import {
  countOrgCompletedSessionsThisMonth,
  countDistinctActiveUsersThisMonthForOrg,
  countUsersByOrganizationId,
  getOrganizationById,
} from "@/db/queries";

export const metadata: Metadata = {
  title: "Billing | SentinelForge",
};

export default async function BillingPage(): Promise<ReactElement> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "enterprise_admin") {
    return <p className="text-slate-400">Forbidden</p>;
  }
  const orgId =
    session.user.organizationId === null || session.user.organizationId === undefined
      ? null
      : Number(session.user.organizationId);
  if (!orgId) {
    return <p className="text-slate-400">No organization on your account.</p>;
  }

  const org = await getOrganizationById(orgId);
  if (!org) {
    return <p className="text-slate-400">Organization not found.</p>;
  }

  const seatsUsed = await countUsersByOrganizationId(orgId);
  const scenariosMonth = await countOrgCompletedSessionsThisMonth(orgId);
  const activeUsersMonth = await countDistinctActiveUsersThisMonthForOrg(orgId);

  const plans = [
    {
      plan: "free" as const,
      title: "Free",
      description: "Small teams evaluating SentinelForge.",
      monthlyPriceUsd: 0,
      annualPriceUsd: 0,
      features: ["Up to 5 users", "10 scenarios", "Basic analytics", "Community support"],
      icon: Shield,
    },
    {
      plan: "academic" as const,
      title: "Academic",
      description: "Universities and training programs.",
      monthlyPriceUsd: 50,
      annualPriceUsd: 500,
      features: [
        "Unlimited users",
        "All scenarios",
        "Advanced analytics",
        "Slack integration",
        "Mentor AI",
      ],
      icon: GraduationCap,
    },
    {
      plan: "enterprise" as const,
      title: "Enterprise",
      description: "SOC teams at scale.",
      monthlyPriceUsd: 500,
      annualPriceUsd: 5000,
      features: [
        "Everything in Academic",
        "Priority support",
        "Custom scenarios",
        "API access",
        "SSO (roadmap)",
      ],
      icon: Rocket,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-white">Billing & plans</h1>
        <p className="mt-1 text-sm text-slate-400">
          Free plan runs without Stripe. Paid plans use Stripe Checkout (configure price IDs in
          environment).
        </p>
      </div>

      <UsageMeter
        organizationName={org.name}
        seatsUsed={seatsUsed}
        seatLimit={org.seatLimit}
        scenariosCompletedThisMonth={scenariosMonth}
        activeUsersThisMonth={activeUsersMonth}
      />

      <BillingClient currentPlan={org.plan as "free" | "academic" | "enterprise"} plans={plans} />

      <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-400">
        <p>
          <strong className="text-slate-200">Stripe customer portal:</strong> manage payment method,
          invoices, and cancellation after you have an active subscription.
        </p>
      </div>
    </div>
  );
}
