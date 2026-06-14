"use client";

import { format } from "date-fns";
import { ChevronDown, MapPin, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { useMemo, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { parseRequiredSkills } from "@/lib/agents/placement/parse-job-skills";
import type { MatchResult } from "@/lib/agents/placement/matcher";
import { cn } from "@/lib/utils";
import type { Job, JobApplication } from "@/types";

export type JobWithOrg = Job & {
  organization: { id: number; name: string; slug: string } | null;
};

export type JobsBoardProps = {
  initialJobs: { job: JobWithOrg; match: MatchResult }[];
  applications: (JobApplication & {
    job: JobWithOrg | null;
  })[];
  categoryScores: Record<string, number>;
  filterDefaults: {
    location: string;
    jobType: string;
    experienceLevel: string;
    search: string;
  };
};

function statusLabel(s: string): string {
  return s.replace(/_/g, " ");
}

function OrgLogo({ name }: { name: string }): ReactElement {
  const ch = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-sm font-bold text-emerald-400 ring-1 ring-slate-700">
      {ch}
    </div>
  );
}

export function JobsBoard({
  initialJobs,
  applications,
  categoryScores,
  filterDefaults,
}: JobsBoardProps): ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [location, setLocation] = useState(filterDefaults.location);
  const [jobType, setJobType] = useState(filterDefaults.jobType);
  const [experienceLevel, setExperienceLevel] = useState(filterDefaults.experienceLevel);
  const [search, setSearch] = useState(filterDefaults.search);

  const filtered = useMemo(() => {
    const loc = location.trim().toLowerCase();
    return initialJobs.filter(({ job }) => {
      if (loc && !(job.location ?? "").toLowerCase().includes(loc)) return false;
      return true;
    });
  }, [initialJobs, location]);

  function applyFilters(): void {
    const p = new URLSearchParams();
    if (location.trim()) p.set("location", location.trim());
    if (jobType && jobType !== "all") p.set("jobType", jobType);
    if (experienceLevel && experienceLevel !== "all") p.set("experienceLevel", experienceLevel);
    if (search.trim()) p.set("search", search.trim());
    startTransition(() => {
      router.push(`/dashboard/jobs${p.toString() ? `?${p.toString()}` : ""}`);
    });
  }

  async function withdraw(appId: number): Promise<void> {
    const res = await fetch(`/api/jobs/applications/${appId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "withdrawn" }),
    });
    if (res.ok) router.refresh();
  }

  async function apply(jobId: number): Promise<void> {
    const res = await fetch(`/api/jobs/${jobId}/apply`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (res.ok) router.refresh();
    else {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      alert(j.error ?? "Could not apply");
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Job opportunities</h1>
        <p className="mt-1 text-sm text-slate-400">
          Placement-ready roles matched to your SentinelForge skill profile.
        </p>
      </div>

      <Card className="border-slate-800 bg-slate-950/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-white">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-end">
          <div className="min-w-[160px] flex-1">
            <label className="text-xs font-medium text-slate-500">Search</label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Title or description"
                className="border-slate-700 bg-slate-900 pl-9"
              />
            </div>
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs font-medium text-slate-500">Location</label>
            <div className="relative mt-1">
              <MapPin className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="City / remote"
                className="border-slate-700 bg-slate-900 pl-9"
              />
            </div>
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs font-medium text-slate-500">Job type</label>
            <Select value={jobType} onValueChange={setJobType}>
              <SelectTrigger className="mt-1 border-slate-700 bg-slate-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="full_time">Full time</SelectItem>
                <SelectItem value="part_time">Part time</SelectItem>
                <SelectItem value="contract">Contract</SelectItem>
                <SelectItem value="internship">Internship</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[140px]">
            <label className="text-xs font-medium text-slate-500">Experience</label>
            <Select value={experienceLevel} onValueChange={setExperienceLevel}>
              <SelectTrigger className="mt-1 border-slate-700 bg-slate-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="entry">Entry</SelectItem>
                <SelectItem value="mid">Mid</SelectItem>
                <SelectItem value="senior">Senior</SelectItem>
                <SelectItem value="lead">Lead</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-500"
            disabled={pending}
            onClick={() => applyFilters()}
          >
            Apply filters
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filtered.length === 0 ? (
          <p className="text-slate-500">No roles match your filters.</p>
        ) : (
          filtered.map(({ job, match }) => {
            const orgName = job.organization?.name ?? "Employer";
            const reqs = parseRequiredSkills(job.requiredSkills);
            const existing = applications.find(
              (a) =>
                a.jobId === job.id &&
                !["withdrawn", "rejected"].includes(a.status),
            );
            return (
              <Card key={job.id} className="border-slate-800 bg-slate-950/60">
                <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
                  <OrgLogo name={orgName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg text-white">{job.title}</CardTitle>
                      <Badge variant="outline" className="border-slate-600 text-slate-300">
                        {match.overallScore}% match
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-400">{orgName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {[job.location, job.salaryRange].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <Button asChild size="sm" variant="outline" className="border-slate-600">
                      <Link href={`/dashboard/jobs/${job.id}`}>View details</Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-500"
                      disabled={match.overallScore < 50 || Boolean(existing)}
                      onClick={() => void apply(job.id)}
                    >
                      {existing ? "Applied" : "Apply"}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {reqs.map((r) => {
                      const have = categoryScores[r.key] ?? 0;
                      const ok = have >= r.minScore;
                      return (
                        <span
                          key={r.key}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs font-medium ring-1",
                            ok
                              ? "bg-emerald-950/50 text-emerald-300 ring-emerald-800"
                              : "bg-red-950/40 text-red-300 ring-red-900",
                          )}
                        >
                          {r.label}: {have}/{r.minScore}
                        </span>
                      );
                    })}
                  </div>
                  <details className="group rounded-lg border border-slate-800 bg-slate-900/40">
                    <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm text-slate-300 [&::-webkit-details-marker]:hidden">
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                      Preview description
                    </summary>
                    <p className="border-t border-slate-800 px-3 py-2 text-sm text-slate-400">{job.description}</p>
                  </details>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white">My applications</h2>
        <p className="mt-1 text-sm text-slate-400">Track status and withdraw if your plans change.</p>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Role</TableHead>
                <TableHead className="text-slate-400">Company</TableHead>
                <TableHead className="text-slate-400">Match</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Applied</TableHead>
                <TableHead className="text-right text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applications.length === 0 ? (
                <TableRow className="border-slate-800">
                  <TableCell colSpan={6} className="text-slate-500">
                    You have not applied to any roles yet.
                  </TableCell>
                </TableRow>
              ) : (
                applications.map((a) => (
                  <TableRow key={a.id} className="border-slate-800">
                    <TableCell className="font-medium text-white">{a.job?.title ?? "—"}</TableCell>
                    <TableCell className="text-slate-400">{a.job?.organization?.name ?? "—"}</TableCell>
                    <TableCell className="text-slate-300">{a.matchScore ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="border-slate-700 bg-slate-800 capitalize">
                        {statusLabel(a.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-slate-400">
                      {format(new Date(a.appliedAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      {a.status !== "withdrawn" &&
                      a.status !== "rejected" &&
                      a.status !== "accepted" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-amber-400 hover:text-amber-300"
                          onClick={() => void withdraw(a.id)}
                        >
                          Withdraw
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
