"use client";

import { Eye, EyeOff, Loader2 } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";
import { useState } from "react";

import { CertificationShowcase } from "@/components/jobs/certification-showcase";
import { SkillRadar } from "@/components/analytics/skill-radar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CategoryRadarPoint } from "@/db/dashboard-queries";
import type { Category, User } from "@/types";

type MatrixCat = { name: string; averageScore: number; skills: { name: string; score: number }[] };

type CertRow = { certificationId: string; earnedAt: Date | string };

type TrainingRow = {
  id: number;
  finalScore: number | null;
  completedAt: Date | string | null;
  scenario: { name: string } | null;
};

export type ProfileFormProps = {
  preview: boolean;
  initialUser: Omit<User, "passwordHash">;
  matrix: MatrixCat[];
  certifications: CertRow[];
  trainingHistory: TrainingRow[];
};

export function ProfileForm({
  preview,
  initialUser,
  matrix,
  certifications,
  trainingHistory,
}: ProfileFormProps): ReactElement {
  const [user, setUser] = useState(initialUser);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const categoryScores = Object.fromEntries(matrix.map((c) => [c.name, c.averageScore]));
  const radar: CategoryRadarPoint[] = matrix.map((c) => ({
    category: c.name as Category,
    label: c.name.replace(/_/g, " "),
    score: c.averageScore,
  }));

  async function save(): Promise<void> {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.name,
          profileBio: user.profileBio,
          profileLocation: user.profileLocation,
          profilePublic: user.profilePublic,
          linkedinUrl: user.linkedinUrl,
          portfolioUrl: user.portfolioUrl,
          resumeUrl: user.resumeUrl,
          jobSearchExperienceLevel: user.jobSearchExperienceLevel,
          image: user.image,
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Save failed");
      }
      const data = (await res.json()) as { user: typeof user };
      setUser(data.user);
      setMessage("Saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  if (preview) {
    return (
      <div className="space-y-8">
        <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
          Recruiter preview: this is how public fields appear when your profile is visible to employers.
        </div>
        <Card className="border-slate-800 bg-slate-950/60">
          <CardHeader>
            <CardTitle className="text-white">{user.name}</CardTitle>
            <p className="text-sm text-slate-400">{user.profileLocation ?? "Location not set"}</p>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-slate-300">
            <p>{user.profileBio ?? "No bio yet."}</p>
            {user.linkedinUrl ? (
              <a className="text-emerald-400 hover:underline" href={user.linkedinUrl}>
                LinkedIn
              </a>
            ) : null}
          </CardContent>
        </Card>
        <Button asChild variant="outline" className="mt-4 border-slate-700">
          <Link href="/dashboard/profile">
            <EyeOff className="mr-2 h-4 w-4" />
            Exit preview
          </Link>
        </Button>
        <CertificationShowcase earned={certifications} categoryScores={categoryScores} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Your profile</h1>
          <p className="mt-1 text-sm text-slate-400">
            Control visibility for placement and keep your training narrative up to date.
          </p>
        </div>
        <Button asChild variant="outline" className="border-slate-700">
          <Link href="/dashboard/profile?preview=1" className="gap-2">
            <Eye className="h-4 w-4" />
            View as recruiter
          </Link>
        </Button>
      </div>

      <Card className="border-slate-800 bg-slate-950/60">
        <CardHeader>
          <CardTitle className="text-lg text-white">Basics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={user.name}
              onChange={(e) => setUser((u) => ({ ...u, name: e.target.value }))}
              className="mt-1 border-slate-700 bg-slate-900"
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={user.email} disabled className="mt-1 border-slate-800 bg-slate-900/50 text-slate-500" />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              rows={4}
              value={user.profileBio ?? ""}
              onChange={(e) => setUser((u) => ({ ...u, profileBio: e.target.value }))}
              className="mt-1 border-slate-700 bg-slate-900"
            />
          </div>
          <div>
            <Label htmlFor="loc">Location</Label>
            <Input
              id="loc"
              value={user.profileLocation ?? ""}
              onChange={(e) => setUser((u) => ({ ...u, profileLocation: e.target.value }))}
              className="mt-1 border-slate-700 bg-slate-900"
            />
          </div>
          <div>
            <Label htmlFor="exp">Job search experience level</Label>
            <Input
              id="exp"
              value={user.jobSearchExperienceLevel ?? ""}
              onChange={(e) => setUser((u) => ({ ...u, jobSearchExperienceLevel: e.target.value }))}
              placeholder="e.g. mid, senior"
              className="mt-1 border-slate-700 bg-slate-900"
            />
          </div>
          <div>
            <Label htmlFor="li">LinkedIn URL</Label>
            <Input
              id="li"
              value={user.linkedinUrl ?? ""}
              onChange={(e) => setUser((u) => ({ ...u, linkedinUrl: e.target.value }))}
              className="mt-1 border-slate-700 bg-slate-900"
            />
          </div>
          <div>
            <Label htmlFor="pf">Portfolio URL</Label>
            <Input
              id="pf"
              value={user.portfolioUrl ?? ""}
              onChange={(e) => setUser((u) => ({ ...u, portfolioUrl: e.target.value }))}
              className="mt-1 border-slate-700 bg-slate-900"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="cv">Resume / CV URL</Label>
            <Input
              id="cv"
              value={user.resumeUrl ?? ""}
              onChange={(e) => setUser((u) => ({ ...u, resumeUrl: e.target.value }))}
              className="mt-1 border-slate-700 bg-slate-900"
            />
          </div>
          <div>
            <Label htmlFor="img">Avatar image URL</Label>
            <Input
              id="img"
              value={user.image ?? ""}
              onChange={(e) => setUser((u) => ({ ...u, image: e.target.value }))}
              className="mt-1 border-slate-700 bg-slate-900"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300 md:col-span-2">
            {user.profilePublic ? <Eye className="h-4 w-4 text-emerald-400" /> : <EyeOff className="h-4 w-4" />}
            <input
              type="checkbox"
              className="rounded border-slate-600 bg-slate-900"
              checked={user.profilePublic}
              onChange={(e) => setUser((u) => ({ ...u, profilePublic: e.target.checked }))}
            />
            Public profile (visible in placement candidate search)
          </label>
          <div className="md:col-span-2">
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-500"
              disabled={saving}
              onClick={() => void save()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save changes"}
            </Button>
            {message ? <span className="ml-3 text-sm text-slate-400">{message}</span> : null}
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-white">Skill matrix</h2>
        <p className="mt-1 text-sm text-slate-400">Category averages from your evaluator assessments.</p>
        <Card className="mt-4 border-slate-800 bg-slate-950/60">
          <CardContent className="pt-6">
            {radar.length ? (
              <SkillRadar data={radar} />
            ) : (
              <p className="text-sm text-slate-500">Complete training to populate your matrix.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white">Certifications</h2>
        <CertificationShowcase earned={certifications} categoryScores={categoryScores} className="mt-4" />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white">Training history</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-900/80 text-slate-400">
              <tr>
                <th className="px-3 py-2">Scenario</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2">Completed</th>
              </tr>
            </thead>
            <tbody>
              {trainingHistory.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-slate-500">
                    No completed sessions yet.
                  </td>
                </tr>
              ) : (
                trainingHistory.map((t) => (
                  <tr key={t.id} className="border-t border-slate-800">
                    <td className="px-3 py-2 text-slate-200">{t.scenario?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-300">{t.finalScore ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-400">
                      {t.completedAt
                        ? typeof t.completedAt === "string"
                          ? new Date(t.completedAt).toLocaleDateString()
                          : t.completedAt.toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
