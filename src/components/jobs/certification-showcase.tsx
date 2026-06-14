"use client";

import { Award, Lock } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CERTIFICATIONS, type Certification } from "@/lib/agents/evaluator/certification-catalog";
import { cn } from "@/lib/utils";

type Earned = { certificationId: string; earnedAt: Date | string };

type CertificationShowcaseProps = {
  earned: Earned[];
  categoryScores?: Record<string, number>;
  className?: string;
};

function progressToward(cert: Certification, scores: Record<string, number> | undefined): number {
  if (!scores || cert.requirements.length === 0) return 0;
  let parts = 0;
  let sum = 0;
  for (const r of cert.requirements) {
    const s = scores[r.skillCategory] ?? 0;
    const p = Math.min(1, s / Math.max(1, r.minimumScore));
    parts += 1;
    sum += p;
  }
  return Math.round((sum / parts) * 100);
}

export function CertificationShowcase({
  earned,
  categoryScores,
  className,
}: CertificationShowcaseProps): ReactElement {
  const [openId, setOpenId] = useState<string | null>(null);
  const earnedSet = useMemo(() => new Set(earned.map((e) => e.certificationId)), [earned]);

  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {CERTIFICATIONS.map((cert) => {
        const row = earned.find((e) => e.certificationId === cert.id);
        const has = earnedSet.has(cert.id);
        const progress = has ? 100 : progressToward(cert, categoryScores);

        return (
          <Dialog
            key={cert.id}
            open={openId === cert.id}
            onOpenChange={(o) => setOpenId(o ? cert.id : null)}
          >
            <div
              className={cn(
                "flex flex-col rounded-xl border p-4 transition-colors",
                has
                  ? "border-emerald-500/40 bg-emerald-950/20"
                  : "border-slate-800 bg-slate-900/40 opacity-80",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {has ? (
                    <Award className="h-8 w-8 text-emerald-400" aria-hidden />
                  ) : (
                    <Lock className="h-8 w-8 text-slate-500" aria-hidden />
                  )}
                  <div>
                    <p className="font-semibold text-white">{cert.name}</p>
                    {row ? (
                      <p className="text-xs text-slate-400">
                        Earned{" "}
                        {typeof row.earnedAt === "string"
                          ? new Date(row.earnedAt).toLocaleDateString()
                          : row.earnedAt.toLocaleDateString()}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">Not earned yet</p>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className="shrink-0 border-slate-700 bg-slate-800">
                  {cert.badge}
                </Badge>
              </div>
              <p className="mt-3 line-clamp-2 text-sm text-slate-400">{cert.description}</p>
              <p className="mt-2 text-xs font-medium text-slate-500">Skills covered</p>
              <ul className="mt-1 list-inside list-disc text-xs text-slate-400">
                {[...new Set(cert.requirements.map((r) => r.skillCategory))].map((c) => (
                  <li key={c}>{c.replace(/_/g, " ")}</li>
                ))}
              </ul>
              {!has ? (
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5 bg-slate-800" />
                </div>
              ) : null}
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-4 border-slate-700 text-slate-200 hover:bg-slate-800"
                >
                  {has ? "View details" : "Requirements & training"}
                </Button>
              </DialogTrigger>
            </div>
            <DialogContent className="max-h-[85vh] overflow-y-auto border-slate-800 bg-slate-950 text-slate-100">
              <DialogHeader>
                <DialogTitle>{cert.name}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-slate-400">{cert.description}</p>
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-white">Requirements</p>
                <ul className="space-y-2 text-sm text-slate-300">
                  {cert.requirements.map((r) => (
                    <li key={`${cert.id}-${r.skillCategory}`} className="rounded-lg bg-slate-900/80 p-2">
                      <span className="font-medium text-emerald-300/90">
                        {r.skillCategory.replace(/_/g, " ")}
                      </span>
                      : score ≥ {r.minimumScore}, {r.scenariosCompleted}+ scenarios completed
                    </li>
                  ))}
                </ul>
              </div>
              <Button asChild className="mt-4 w-full bg-emerald-600 hover:bg-emerald-500">
                <Link href="/dashboard/training" onClick={() => setOpenId(null)}>
                  Go to training
                </Link>
              </Button>
            </DialogContent>
          </Dialog>
        );
      })}
    </div>
  );
}
