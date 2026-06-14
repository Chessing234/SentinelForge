"use client";

import { Mail, CalendarClock } from "lucide-react";
import type { ReactElement } from "react";
import { useState } from "react";

import { SkillMatchBar, type SkillMatchRow } from "@/components/jobs/skill-match-bar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CERTIFICATIONS } from "@/lib/agents/evaluator/certification-catalog";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/types";

export type CandidateCardProps = {
  name: string;
  email: string;
  image?: string | null;
  location?: string | null;
  overallScore: number;
  skillMatch: number;
  experienceMatch: number;
  certificationMatch: number;
  skillRows: SkillMatchRow[];
  certificationIds: string[];
  trainingSummary: string;
  applicationId: number;
  status: ApplicationStatus;
  onStatusChange?: (applicationId: number, status: ApplicationStatus) => Promise<void> | void;
};

function initials(n: string): string {
  const p = n.trim().split(/\s+/);
  if (p.length === 1) return p[0]!.slice(0, 2).toUpperCase();
  return `${p[0]![0] ?? ""}${p[1]![0] ?? ""}`.toUpperCase();
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-300";
  return "text-red-400";
}

const statusOptions: ApplicationStatus[] = [
  "applied",
  "reviewing",
  "interview",
  "offered",
  "rejected",
  "accepted",
];

export function CandidateCard({
  name,
  email,
  image,
  location,
  overallScore,
  skillMatch,
  experienceMatch,
  certificationMatch,
  skillRows,
  certificationIds,
  trainingSummary,
  applicationId,
  status,
  onStatusChange,
}: CandidateCardProps): ReactElement {
  const [localStatus, setLocalStatus] = useState(status);
  const [busy, setBusy] = useState(false);

  return (
    <Card className="border-slate-800 bg-slate-950/80">
      <CardHeader className="flex flex-row items-start gap-4 space-y-0">
        <Avatar className="h-14 w-14 border border-slate-700">
          <AvatarImage src={image ?? undefined} alt="" />
          <AvatarFallback className="bg-slate-800 text-slate-200">{initials(name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-lg text-white">{name}</CardTitle>
          <p className="text-sm text-slate-400">{email}</p>
          {location ? <p className="text-xs text-slate-500">{location}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-slate-500">Match</p>
          <p className={cn("text-3xl font-bold tabular-nums", scoreColor(overallScore))}>{overallScore}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-slate-900/80 py-2">
            <p className="text-slate-500">Skills</p>
            <p className={cn("font-semibold", scoreColor(skillMatch))}>{skillMatch}%</p>
          </div>
          <div className="rounded-lg bg-slate-900/80 py-2">
            <p className="text-slate-500">Experience</p>
            <p className={cn("font-semibold", scoreColor(experienceMatch))}>{experienceMatch}%</p>
          </div>
          <div className="rounded-lg bg-slate-900/80 py-2">
            <p className="text-slate-500">Certs</p>
            <p className={cn("font-semibold", scoreColor(certificationMatch))}>{certificationMatch}%</p>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-white">Required vs actual</p>
          <SkillMatchBar rows={skillRows} />
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-white">Certifications</p>
          <div className="flex flex-wrap gap-1">
            {certificationIds.length === 0 ? (
              <span className="text-xs text-slate-500">None on record</span>
            ) : (
              certificationIds.map((id) => {
                const c = CERTIFICATIONS.find((x) => x.id === id);
                return (
                  <Badge key={id} variant="secondary" className="border-slate-700 bg-slate-800">
                    {c?.name ?? id}
                  </Badge>
                );
              })
            )}
          </div>
        </div>

        <p className="text-sm text-slate-400">{trainingSummary}</p>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="border-slate-700" asChild>
            <a href={`mailto:${email}`}>
              <Mail className="mr-1 h-4 w-4" />
              Email
            </a>
          </Button>
          <Button type="button" variant="outline" size="sm" className="border-slate-700" asChild>
            <a href={`mailto:${email}?subject=Interview%20request`}>
              <CalendarClock className="mr-1 h-4 w-4" />
              Schedule interview
            </a>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-400">Application status</span>
          <Select
            value={localStatus}
            disabled={busy || localStatus === "withdrawn"}
            onValueChange={async (v) => {
              const next = v as ApplicationStatus;
              setBusy(true);
              try {
                await onStatusChange?.(applicationId, next);
                setLocalStatus(next);
              } finally {
                setBusy(false);
              }
            }}
          >
            <SelectTrigger className="w-[180px] border-slate-700 bg-slate-900">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
