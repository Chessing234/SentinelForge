"use client";

import {
  Cloud,
  Crosshair,
  FileSearch,
  Globe,
  Network,
  ShieldAlert,
  Skull,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { DifficultyBadge } from "@/components/dashboard/difficulty-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { scenarioCategoryEnum, scenarioDifficultyEnum } from "@/db/schema";
import { cn } from "@/lib/utils";
import type { Category, Difficulty, Scenario } from "@/types";
import type { ReactNode } from "react";

const difficulties = ["all", ...scenarioDifficultyEnum.enumValues] as const;
const categories = ["all", ...scenarioCategoryEnum.enumValues] as const;

const categoryIcon = (c: Category): ReactNode => {
  const iconClass = "h-4 w-4 shrink-0 text-emerald-500/90";
  const map: Record<Category, ReactNode> = {
    network_security: <Network className={iconClass} aria-hidden />,
    web_security: <Globe className={iconClass} aria-hidden />,
    cloud_security: <Cloud className={iconClass} aria-hidden />,
    incident_response: <Crosshair className={iconClass} aria-hidden />,
    malware_analysis: <Skull className={iconClass} aria-hidden />,
    forensics: <FileSearch className={iconClass} aria-hidden />,
  };
  return map[c];
};

function formatCategory(c: Category): string {
  return c.replace(/_/g, " ");
}

type ScenarioBrowserProps = {
  scenarios: Scenario[];
};

export function ScenarioBrowser({ scenarios }: ScenarioBrowserProps) {
  const [difficulty, setDifficulty] = useState<(typeof difficulties)[number]>("all");
  const [category, setCategory] = useState<(typeof categories)[number]>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scenarios.filter((s) => {
      if (difficulty !== "all" && s.difficulty !== difficulty) return false;
      if (category !== "all" && s.category !== category) return false;
      if (q) {
        const hay = `${s.name} ${s.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [scenarios, difficulty, category, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end">
        <div className="space-y-2 md:w-48">
          <label className="text-xs font-medium text-slate-400">Difficulty</label>
          <Select
            value={difficulty}
            onValueChange={(v) => setDifficulty(v as (typeof difficulties)[number])}
          >
            <SelectTrigger className="border-slate-700 bg-slate-900 text-slate-100">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent className="border-slate-800 bg-slate-900 text-slate-100">
              {difficulties.map((d) => (
                <SelectItem key={d} value={d} className="capitalize">
                  {d === "all" ? "All" : d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 md:w-56">
          <label className="text-xs font-medium text-slate-400">Category</label>
          <Select
            value={category}
            onValueChange={(v) => setCategory(v as (typeof categories)[number])}
          >
            <SelectTrigger className="border-slate-700 bg-slate-900 text-slate-100">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent className="border-slate-800 bg-slate-900 text-slate-100">
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === "all" ? "All categories" : formatCategory(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <label className="text-xs font-medium text-slate-400">Search</label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by name or description…"
            className="border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((s) => {
          const tags = s.mitreTechniques.split(",").map((t) => t.trim());
          return (
            <Card
              key={s.id}
              className={cn(
                "flex flex-col border-slate-800 bg-slate-900/50 transition-all duration-200",
                "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-emerald-950/20",
              )}
            >
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-2">
                    <span className="mt-0.5">{categoryIcon(s.category)}</span>
                    <CardTitle className="text-lg leading-tight text-white">
                      {s.name}
                    </CardTitle>
                  </div>
                  <DifficultyBadge difficulty={s.difficulty as Difficulty} />
                </div>
                <p className="line-clamp-3 text-sm text-slate-400">{s.description}</p>
              </CardHeader>
              <CardContent className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <ShieldAlert className="h-3.5 w-3.5 text-slate-500" aria-hidden />
                  <span>{s.estimatedDuration} min</span>
                  <span className="text-slate-600">·</span>
                  <span className="capitalize text-slate-400">
                    {formatCategory(s.category)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="rounded border border-slate-700 bg-slate-950 px-2 py-0.5 font-mono text-[10px] text-emerald-300/90"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  asChild
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  <Link href={`/dashboard/training/simulator/new?scenarioId=${s.id}`}>
                    Start Training
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500">
          No scenarios match your filters.
        </p>
      ) : null}
    </div>
  );
}
