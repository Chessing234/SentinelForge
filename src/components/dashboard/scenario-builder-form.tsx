"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const DIFFICULTIES = ["beginner", "intermediate", "advanced", "expert"] as const;
const CATEGORIES = [
  "network_security",
  "web_security",
  "cloud_security",
  "incident_response",
  "malware_analysis",
  "forensics",
] as const;

export function ScenarioBuilderForm(): ReactElement {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("beginner");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("network_security");
  const [mitreTechniques, setMitreTechniques] = useState("T1078, T1059");
  const [estimatedDuration, setEstimatedDuration] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/scenarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name,
          description,
          difficulty,
          category,
          mitreTechniques,
          estimatedDuration,
        }),
      });
      const json = (await res.json()) as { scenario?: { id: number; name: string }; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to create scenario");
        return;
      }
      setSuccess(`Created “${json.scenario?.name ?? name}”. It is active in the catalog.`);
      setName("");
      setDescription("");
      router.refresh();
    } catch {
      setError("Network error while creating scenario.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="max-w-xl space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="name" className="text-sm font-medium text-slate-200">
          Name
        </label>
        <Input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border-slate-700 bg-slate-900 text-white"
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="description" className="text-sm font-medium text-slate-200">
          Description
        </label>
        <Textarea
          id="description"
          required
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border-slate-700 bg-slate-900 text-white"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="difficulty" className="text-sm font-medium text-slate-200">
            Difficulty
          </label>
          <select
            id="difficulty"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as (typeof DIFFICULTIES)[number])}
            className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="category" className="text-sm font-medium text-slate-200">
            Category
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
            className="h-10 w-full rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="mitre" className="text-sm font-medium text-slate-200">
            MITRE technique IDs
          </label>
          <Input
            id="mitre"
            required
            value={mitreTechniques}
            onChange={(e) => setMitreTechniques(e.target.value)}
            className="border-slate-700 bg-slate-900 text-white"
          />
          <p className="text-[10px] text-slate-500">Comma-separated, e.g. T1078, T1059.001</p>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="duration" className="text-sm font-medium text-slate-200">
            Est. duration (minutes)
          </label>
          <Input
            id="duration"
            type="number"
            min={5}
            max={240}
            required
            value={estimatedDuration}
            onChange={(e) => setEstimatedDuration(Number(e.target.value))}
            className="border-slate-700 bg-slate-900 text-white"
          />
        </div>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {success ? <p className="text-sm text-emerald-400">{success}</p> : null}

      <Button type="submit" disabled={busy} className="bg-emerald-600 text-white hover:bg-emerald-500">
        {busy ? "Publishing…" : "Publish scenario"}
      </Button>
    </form>
  );
}
