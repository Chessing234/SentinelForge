import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import { SkillMatchBar, type SkillMatchRow } from "@/components/jobs/skill-match-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/auth";
import { getActiveScenarios, getJobById } from "@/db/queries";
import { getUserSkillMatrix } from "@/lib/agents/evaluator/skill-matrix";
import { parseRequiredSkills } from "@/lib/agents/placement/parse-job-skills";
import { placementAgent } from "@/lib/agents/placement";
import type { Category } from "@/types";

import { JobApplyButton } from "../job-apply-button";

type PageProps = { params: Promise<{ jobId: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { jobId } = await params;
  const id = Number(jobId);
  if (!Number.isFinite(id)) return { title: "Job | SentinelForge" };
  const job = await getJobById(id);
  return { title: job ? `${job.title} | SentinelForge` : "Job | SentinelForge" };
}

export default async function JobDetailPage({ params }: PageProps): Promise<ReactElement> {
  const { jobId } = await params;
  const id = Number(jobId);
  if (!Number.isFinite(id)) notFound();

  const session = await auth();
  if (!session?.user?.id) notFound();

  const job = await getJobById(id);
  if (!job) notFound();

  const role = session.user.role ?? "student";
  const orgId =
    session.user.organizationId === null || session.user.organizationId === undefined
      ? null
      : Number(session.user.organizationId);
  const isOwner =
    role === "admin" || (role === "enterprise_admin" && orgId === job.organizationId);
  if (!isOwner && (!job.published || job.status !== "open")) {
    notFound();
  }

  const userId = Number(session.user.id);
  const [match, matrix, allScenarios] = await Promise.all([
    placementAgent.calculateMatch(userId, job.id),
    getUserSkillMatrix(userId),
    getActiveScenarios(),
  ]);
  const catScore = new Map(matrix.map((c) => [c.name, c.averageScore]));
  const reqs = parseRequiredSkills(job.requiredSkills);
  const skillRows: SkillMatchRow[] = reqs.map((r) => ({
    key: r.key,
    label: r.label,
    required: r.minScore,
    actual: catScore.get(r.key) ?? 0,
  }));

  const scenarioIds = new Set<number>();
  for (const g of match.gapAnalysis) {
    for (const sid of g.recommendedScenarioIds) scenarioIds.add(sid);
  }
  const related: { id: number; name: string; difficulty: string }[] = [];
  for (const sid of scenarioIds) {
    const s = allScenarios.find((x) => x.id === sid);
    if (s) related.push({ id: s.id, name: s.name, difficulty: s.difficulty });
  }
  if (related.length === 0 && match.gapAnalysis[0]) {
    const cat = match.gapAnalysis[0]!.category as Category;
    const pool = await getActiveScenarios({ category: cat });
    for (const s of pool.slice(0, 4)) {
      related.push({ id: s.id, name: s.name, difficulty: s.difficulty });
    }
  }

  const orgName = job.organization?.name ?? "Employer";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">{orgName}</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">{job.title}</h1>
          <p className="mt-2 text-sm text-slate-400">
            {[job.location, job.salaryRange, job.jobType, job.experienceLevel].filter(Boolean).join(" · ")}
          </p>
        </div>
        <JobApplyButton jobId={id} disabled={match.overallScore < 50} />
      </div>

      <Card className="border-slate-800 bg-slate-950/60">
        <CardHeader>
          <CardTitle className="text-base text-white">Your match</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-4xl font-bold text-emerald-400">{match.overallScore}</p>
            <p className="text-sm text-slate-400">Overall placement score</p>
          </div>
          <div className="space-y-2 text-sm text-slate-300">
            <p>
              <span className="text-slate-500">Skills:</span> {match.skillMatch}%
            </p>
            <p>
              <span className="text-slate-500">Experience:</span> {match.experienceMatch}%
            </p>
            <p>
              <span className="text-slate-500">Certifications:</span> {match.certificationMatch}%
            </p>
            <Badge variant="outline" className="mt-2 capitalize border-slate-600 text-slate-200">
              {match.recommendation.replace(/_/g, " ")}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-white">Role description</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">{job.description}</p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white">Skill fit</h2>
        <p className="mt-1 text-sm text-slate-400">Bars show your category scores against what this role expects.</p>
        <Card className="mt-4 border-slate-800 bg-slate-950/60">
          <CardContent className="pt-6">
            <SkillMatchBar rows={skillRows} />
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white">Close your gaps</h2>
        <p className="mt-1 text-sm text-slate-400">Training scenarios aligned to missing requirements.</p>
        <ul className="mt-3 space-y-2">
          {related.length === 0 ? (
            <li className="text-sm text-slate-500">Complete more assessments to unlock targeted recommendations.</li>
          ) : (
            related.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/dashboard/training?scenarioId=${s.id}`}
                  className="text-sm text-emerald-400 hover:text-emerald-300"
                >
                  {s.name}
                </Link>
                <span className="text-xs text-slate-500"> · {s.difficulty}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      <Button asChild variant="outline" className="border-slate-700">
        <Link href="/dashboard/jobs">Back to job board</Link>
      </Button>
    </div>
  );
}
