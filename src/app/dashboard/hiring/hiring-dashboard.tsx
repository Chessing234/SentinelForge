"use client";

import { Copy, Pencil, Users, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { useMemo, useState } from "react";

import { CandidateCard } from "@/components/jobs/candidate-card";
import { JobPostingModal } from "@/components/jobs/job-posting-modal";
import type { SkillMatchRow } from "@/components/jobs/skill-match-bar";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { JobPostingStatRow } from "@/db/queries";
import type { Job } from "@/types";

export type HiringCandidateRow = {
  applicationId: number;
  jobId: number;
  jobTitle: string;
  name: string;
  email: string;
  image: string | null;
  location: string | null;
  status: string;
  matchScore: number | null;
  match: {
    overallScore: number;
    skillMatch: number;
    experienceMatch: number;
    certificationMatch: number;
    skillRows: SkillMatchRow[];
  };
  certificationIds: string[];
  topSkills: string;
  trainingSummary: string;
};

export type HiringDashboardProps = {
  organizationId: number;
  role: string;
  organizationName: string;
  organizations?: { id: number; name: string }[];
  stats: {
    openPositions: number;
    totalApplicants: number;
    avgMatch: number | null;
    timeToHireLabel: string;
  };
  jobRows: JobPostingStatRow[];
  jobsForModal: Job[];
  candidates: HiringCandidateRow[];
};

export function HiringDashboard({
  organizationId,
  role,
  organizationName,
  organizations,
  stats,
  jobRows,
  jobsForModal,
  candidates,
}: HiringDashboardProps): ReactElement {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [duplicateTemplate, setDuplicateTemplate] = useState<Job | null>(null);
  const [sheetRow, setSheetRow] = useState<HiringCandidateRow | null>(null);
  const [minScore, setMinScore] = useState("0");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [skillFilter, setSkillFilter] = useState("");
  const [jobFilter, setJobFilter] = useState<string>("all");

  const filteredCandidates = useMemo(() => {
    const min = Number(minScore);
    const sk = skillFilter.trim().toLowerCase();
    return candidates.filter((c) => {
      if (jobFilter !== "all" && String(c.jobId) !== jobFilter) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (Number.isFinite(min) && min > 0 && (c.matchScore ?? 0) < min) return false;
      if (sk) {
        const hay = `${c.topSkills} ${c.name}`.toLowerCase();
        if (!hay.includes(sk)) return false;
      }
      return true;
    });
  }, [candidates, jobFilter, minScore, skillFilter, statusFilter]);

  async function patchStatus(applicationId: number, status: string): Promise<void> {
    const res = await fetch(`/api/jobs/applications/${applicationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      alert(j.error ?? "Update failed");
      return;
    }
    router.refresh();
  }

  async function closeJob(jobId: number): Promise<void> {
    if (!confirm("Close this posting?")) return;
    const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  async function reopenJob(job: JobPostingStatRow): Promise<void> {
    const res = await fetch(`/api/jobs/${job.jobId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "open", published: true }),
    });
    if (res.ok) router.refresh();
  }

  function duplicateJob(jobId: number): void {
    const j = jobsForModal.find((x) => x.id === jobId);
    if (!j) return;
    setEditing(null);
    setDuplicateTemplate(j);
    setModalOpen(true);
  }

  const orgPicker =
    role === "admin" && organizations && organizations.length > 0 ? (
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-400">Organization</span>
        <Select
          value={String(organizationId)}
          onValueChange={(v) => {
            router.push(`/dashboard/hiring?organizationId=${v}`);
          }}
        >
          <SelectTrigger className="w-[220px] border-slate-700 bg-slate-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((o) => (
              <SelectItem key={o.id} value={String(o.id)}>
                {o.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    ) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Hiring portal</h1>
          <p className="mt-1 text-sm text-slate-400">{organizationName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {orgPicker}
          <Button
            className="bg-emerald-600 hover:bg-emerald-500"
            onClick={() => {
              setEditing(null);
              setDuplicateTemplate(null);
              setModalOpen(true);
            }}
          >
            Post new job
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Open positions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{stats.openPositions}</p>
            <p className="text-xs text-slate-500">Active listings</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Total applicants</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{stats.totalApplicants}</p>
            <p className="text-xs text-slate-500">Excluding withdrawn</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Avg match score</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{stats.avgMatch === null ? "—" : stats.avgMatch}</p>
            <p className="text-xs text-slate-500">Across applications</p>
          </CardContent>
        </Card>
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-400">Time to hire</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{stats.timeToHireLabel}</p>
            <p className="text-xs text-slate-500">Pipeline analytics</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-800 bg-slate-950/60">
        <CardHeader>
          <CardTitle className="text-lg text-white">Job postings</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">Title</TableHead>
                <TableHead className="text-slate-400">Status</TableHead>
                <TableHead className="text-slate-400">Applicants</TableHead>
                <TableHead className="text-slate-400">Avg score</TableHead>
                <TableHead className="text-slate-400">Posted</TableHead>
                <TableHead className="text-right text-slate-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobRows.map((j) => (
                <TableRow key={j.jobId} className="border-slate-800">
                  <TableCell className="font-medium text-white">{j.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-slate-600 capitalize">
                      {j.status}
                      {!j.published ? " · draft" : ""}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-300">{j.applicantCount}</TableCell>
                  <TableCell className="text-slate-300">{j.avgMatch ?? "—"}</TableCell>
                  <TableCell className="text-slate-400">
                    {new Date(j.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-slate-300"
                        onClick={() => {
                          const job = jobsForModal.find((x) => x.id === j.jobId);
                          if (job) {
                            setDuplicateTemplate(null);
                            setEditing(job);
                            setModalOpen(true);
                          }
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {j.status === "open" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-amber-400"
                          onClick={() => void closeJob(j.jobId)}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-emerald-400"
                          onClick={() => void reopenJob(j)}
                        >
                          Reopen
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-slate-300"
                        onClick={() => duplicateJob(j.jobId)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-slate-300"
                        onClick={() => {
                          setJobFilter(String(j.jobId));
                          document.getElementById("candidate-pool")?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card id="candidate-pool" className="border-slate-800 bg-slate-950/60">
        <CardHeader>
          <CardTitle className="text-lg text-white">Candidate pool</CardTitle>
          <p className="text-sm text-slate-400">Applicants across your organization&apos;s postings.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Search name or skills"
              value={skillFilter}
              onChange={(e) => setSkillFilter(e.target.value)}
              className="max-w-xs border-slate-700 bg-slate-900"
            />
            <Select value={minScore} onValueChange={setMinScore}>
              <SelectTrigger className="w-[160px] border-slate-700 bg-slate-900">
                <SelectValue placeholder="Min match" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Any match</SelectItem>
                <SelectItem value="60">60+</SelectItem>
                <SelectItem value="70">70+</SelectItem>
                <SelectItem value="80">80+</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] border-slate-700 bg-slate-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="applied">Applied</SelectItem>
                <SelectItem value="reviewing">Reviewing</SelectItem>
                <SelectItem value="interview">Interview</SelectItem>
                <SelectItem value="offered">Offered</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
              </SelectContent>
            </Select>
            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger className="w-[220px] border-slate-700 bg-slate-900">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All jobs</SelectItem>
                {jobRows.map((j) => (
                  <SelectItem key={j.jobId} value={String(j.jobId)}>
                    {j.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-slate-400">Name</TableHead>
                  <TableHead className="text-slate-400">Job</TableHead>
                  <TableHead className="text-slate-400">Match</TableHead>
                  <TableHead className="text-slate-400">Top skills</TableHead>
                  <TableHead className="text-slate-400">Certs</TableHead>
                  <TableHead className="text-slate-400">Status</TableHead>
                  <TableHead className="text-right text-slate-400">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCandidates.map((c) => (
                  <TableRow key={c.applicationId} className="border-slate-800">
                    <TableCell className="font-medium text-white">{c.name}</TableCell>
                    <TableCell className="max-w-[160px] truncate text-slate-400">{c.jobTitle}</TableCell>
                    <TableCell className="text-emerald-400">{c.matchScore ?? "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-slate-400">{c.topSkills}</TableCell>
                    <TableCell className="text-xs text-slate-400">{c.certificationIds.length}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="border-slate-700 bg-slate-800 capitalize">
                        {c.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button type="button" variant="outline" size="sm" onClick={() => setSheetRow(c)}>
                        View profile
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <JobPostingModal
        open={modalOpen}
        onOpenChange={(v) => {
          setModalOpen(v);
          if (!v) {
            setEditing(null);
            setDuplicateTemplate(null);
          }
        }}
        initialJob={editing}
        duplicateTemplate={duplicateTemplate}
        onSaved={() => router.refresh()}
      />

      <Sheet open={Boolean(sheetRow)} onOpenChange={(o) => !o && setSheetRow(null)}>
        <SheetContent className="w-full overflow-y-auto border-slate-800 bg-slate-950 sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-white">Candidate</SheetTitle>
          </SheetHeader>
          {sheetRow ? (
            <div className="mt-6">
              <CandidateCard
                name={sheetRow.name}
                email={sheetRow.email}
                image={sheetRow.image}
                location={sheetRow.location}
                overallScore={sheetRow.match.overallScore}
                skillMatch={sheetRow.match.skillMatch}
                experienceMatch={sheetRow.match.experienceMatch}
                certificationMatch={sheetRow.match.certificationMatch}
                skillRows={sheetRow.match.skillRows}
                certificationIds={sheetRow.certificationIds}
                trainingSummary={sheetRow.trainingSummary}
                applicationId={sheetRow.applicationId}
                status={sheetRow.status as never}
                onStatusChange={async (id, st) => {
                  await patchStatus(id, st);
                }}
              />
              <Button asChild variant="link" className="mt-4 px-0 text-emerald-400">
                <Link href={`mailto:${sheetRow.email}`}>Send message</Link>
              </Button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
