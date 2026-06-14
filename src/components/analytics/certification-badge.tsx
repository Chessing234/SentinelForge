"use client";

import type { ReactElement } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { Certification } from "@/lib/agents/evaluator/certification-catalog";
import { Check, Copy, Shield, Star } from "lucide-react";

type Row = {
  cert: Certification;
  earned: boolean;
  earnedAt?: string;
};

type CertificationBadgeListProps = {
  rows: Row[];
};

export function CertificationBadgeList({ rows }: CertificationBadgeListProps): ReactElement {
  const [copied, setCopied] = useState<string | null>(null);

  const share = async (cert: Certification) => {
    const text = `${cert.name} — ${cert.description}`;
    await navigator.clipboard.writeText(text);
    setCopied(cert.id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <ul className="space-y-4">
      {rows.map(({ cert, earned, earnedAt }) => (
        <li
          key={cert.id}
          className="rounded-lg border border-slate-800 bg-slate-950/50 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <Shield className="h-6 w-6" />
              <Star className="absolute -bottom-0.5 -right-0.5 h-4 w-4 text-amber-300" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-white">{cert.name}</p>
              <p className="text-sm text-slate-400">{cert.description}</p>
              {earnedAt ? (
                <p className="mt-1 text-xs text-slate-500">Earned {new Date(earnedAt).toLocaleDateString()}</p>
              ) : null}
              <ul className="mt-2 space-y-1 text-xs text-slate-400">
                {cert.requirements.map((r) => (
                  <li key={`${cert.id}-${r.skillCategory}`} className="flex items-center gap-2">
                    <Check
                      className={earned ? "text-emerald-400" : "text-slate-600"}
                      size={14}
                      aria-hidden
                    />
                    <span>
                      {r.skillCategory.replace(/_/g, " ")} ≥ {r.minimumScore} · {r.scenariosCompleted}+
                      sessions
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 border-slate-700 text-xs"
                onClick={() => void share(cert)}
              >
                <Copy className="mr-1 h-3 w-3" />
                {copied === cert.id ? "Copied" : "Share"}
              </Button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
