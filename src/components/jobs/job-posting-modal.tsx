"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CERTIFICATIONS } from "@/lib/agents/evaluator/certification-catalog";
import { SKILL_CATEGORY_OPTIONS } from "@/lib/job-skill-options";
import type { Job } from "@/types";

const jobRequiredSkillSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  minScore: z.number().min(0).max(100),
});

const formSchema = z.object({
  title: z.string().min(2).max(255),
  description: z.string().min(10),
  location: z.string().max(255).optional().nullable(),
  salaryRange: z.string().max(100).optional().nullable(),
  jobType: z.string().max(64).optional().nullable(),
  experienceLevel: z.string().max(64).optional().nullable(),
  requiredSkills: z.array(jobRequiredSkillSchema).min(1),
  preferredCertifications: z.array(z.string()),
  published: z.boolean(),
  status: z.enum(["open", "closed", "filled"]),
});

export type JobPostingModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialJob?: Job | null;
  /** Prefill fields for a new posting cloned from an existing job (always POST). */
  duplicateTemplate?: Job | null;
  onSaved?: () => void;
};

type ReqRow = { key: string; label: string; minScore: number };

export function JobPostingModal({
  open,
  onOpenChange,
  initialJob,
  duplicateTemplate,
  onSaved,
}: JobPostingModalProps): ReactElement {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [salaryRange, setSalaryRange] = useState("");
  const [jobType, setJobType] = useState("full_time");
  const [experienceLevel, setExperienceLevel] = useState("mid");
  const [published, setPublished] = useState(true);
  const [status, setStatus] = useState<"open" | "closed" | "filled">("open");
  const [requiredRows, setRequiredRows] = useState<ReqRow[]>([
    { key: "network_security", label: "Network security", minScore: 65 },
  ]);
  const [addSkillKey, setAddSkillKey] = useState<string>("network_security");
  const [preferred, setPreferred] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    const source = initialJob ?? duplicateTemplate;
    if (source) {
      setTitle(source.title + (duplicateTemplate && !initialJob ? " (copy)" : ""));
      setDescription(source.description);
      setLocation(source.location ?? "");
      setSalaryRange(source.salaryRange ?? "");
      setJobType(source.jobType ?? "full_time");
      setExperienceLevel(source.experienceLevel ?? "mid");
      setPublished(duplicateTemplate && !initialJob ? false : source.published);
      setStatus(duplicateTemplate && !initialJob ? "open" : source.status);
      const raw = source.requiredSkills as unknown;
      const rows: ReqRow[] = [];
      if (Array.isArray(raw)) {
        for (const item of raw) {
          if (!item || typeof item !== "object") continue;
          const o = item as Record<string, unknown>;
          const key = typeof o.key === "string" ? o.key : "";
          const label = typeof o.label === "string" ? o.label : key;
          const minScore = typeof o.minScore === "number" ? o.minScore : Number(o.minScore);
          if (key && Number.isFinite(minScore)) rows.push({ key, label, minScore });
        }
      }
      setRequiredRows(rows.length ? rows : [{ key: "network_security", label: "Network security", minScore: 65 }]);
      const prefs = Array.isArray(source.preferredCertifications)
        ? (source.preferredCertifications as string[])
        : [];
      const map: Record<string, boolean> = {};
      for (const id of prefs) map[id] = true;
      setPreferred(map);
    } else {
      setTitle("");
      setDescription("");
      setLocation("");
      setSalaryRange("");
      setJobType("full_time");
      setExperienceLevel("mid");
      setPublished(true);
      setStatus("open");
      setRequiredRows([{ key: "network_security", label: "Network security", minScore: 65 }]);
      setPreferred({});
    }
  }, [open, initialJob, duplicateTemplate]);

  function addSkillFromPicker(): void {
    const opt = SKILL_CATEGORY_OPTIONS.find((o) => o.key === addSkillKey);
    if (!opt) return;
    if (requiredRows.some((r) => r.key === opt.key)) return;
    setRequiredRows((r) => [...r, { key: opt.key, label: opt.label, minScore: 60 }]);
  }

  function removeRow(idx: number): void {
    setRequiredRows((r) => r.filter((_, i) => i !== idx));
  }

  async function submit(): Promise<void> {
    setError(null);
    const preferredCertifications = Object.entries(preferred)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const parsed = formSchema.safeParse({
      title,
      description,
      location: location || null,
      salaryRange: salaryRange || null,
      jobType: jobType || null,
      experienceLevel: experienceLevel || null,
      requiredSkills: requiredRows,
      preferredCertifications,
      published,
      status,
    });
    if (!parsed.success) {
      setError("Please fix validation errors (title, description, and at least one skill).");
      return;
    }
    setLoading(true);
    try {
      const body = parsed.data;
      if (initialJob && !duplicateTemplate) {
        const res = await fetch(`/api/jobs/${initialJob.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "Update failed");
        }
      } else {
        const res = await fetch("/api/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "Create failed");
        }
      }
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-slate-800 bg-slate-950 text-slate-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialJob && !duplicateTemplate ? "Edit job posting" : "Post new job"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="job-title">Title</Label>
            <Input
              id="job-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 border-slate-700 bg-slate-900"
            />
          </div>
          <div>
            <Label htmlFor="job-desc">Description</Label>
            <Textarea
              id="job-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="mt-1 border-slate-700 bg-slate-900"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="job-loc">Location</Label>
              <Input
                id="job-loc"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1 border-slate-700 bg-slate-900"
              />
            </div>
            <div>
              <Label htmlFor="job-sal">Salary range</Label>
              <Input
                id="job-sal"
                value={salaryRange}
                onChange={(e) => setSalaryRange(e.target.value)}
                className="mt-1 border-slate-700 bg-slate-900"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Job type</Label>
              <Select value={jobType} onValueChange={setJobType}>
                <SelectTrigger className="mt-1 border-slate-700 bg-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full time</SelectItem>
                  <SelectItem value="part_time">Part time</SelectItem>
                  <SelectItem value="contract">Contract</SelectItem>
                  <SelectItem value="internship">Internship</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Experience level</Label>
              <Select value={experienceLevel} onValueChange={setExperienceLevel}>
                <SelectTrigger className="mt-1 border-slate-700 bg-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Entry</SelectItem>
                  <SelectItem value="mid">Mid</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Required skills</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              <Select value={addSkillKey} onValueChange={setAddSkillKey}>
                <SelectTrigger className="w-[200px] border-slate-700 bg-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SKILL_CATEGORY_OPTIONS.map((o) => (
                    <SelectItem key={o.key} value={o.key}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="secondary" onClick={addSkillFromPicker}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {requiredRows.map((row, idx) => (
                <div
                  key={`${row.key}-${idx}`}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/50 p-2"
                >
                  <span className="min-w-[120px] text-sm text-white">{row.label}</span>
                  <Label className="sr-only" htmlFor={`min-${idx}`}>
                    Min score
                  </Label>
                  <Input
                    id={`min-${idx}`}
                    type="number"
                    min={0}
                    max={100}
                    className="h-8 w-20 border-slate-700 bg-slate-900"
                    value={row.minScore}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setRequiredRows((rows) =>
                        rows.map((r, i) => (i === idx ? { ...r, minScore: Number.isFinite(v) ? v : 0 } : r)),
                      );
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-slate-400 hover:text-red-400"
                    onClick={() => removeRow(idx)}
                    aria-label="Remove skill"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Preferred certifications</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {CERTIFICATIONS.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    className="rounded border-slate-600 bg-slate-900"
                    checked={Boolean(preferred[c.id])}
                    onChange={(e) =>
                      setPreferred((p) => ({
                        ...p,
                        [c.id]: e.target.checked,
                      }))
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                className="rounded border-slate-600 bg-slate-900"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              Published
            </label>
            <div className="flex items-center gap-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="w-[140px] border-slate-700 bg-slate-900">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="filled">Filled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error ? <p className="text-sm text-red-400">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-500"
            disabled={loading}
            onClick={() => void submit()}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : initialJob && !duplicateTemplate ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
