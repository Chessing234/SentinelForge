export type JobRequiredSkill = {
  key: string;
  label: string;
  minScore: number;
};

export function parseRequiredSkills(raw: unknown): JobRequiredSkill[] {
  if (Array.isArray(raw)) {
    const out: JobRequiredSkill[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const key = typeof o.key === "string" ? o.key : "";
      const label = typeof o.label === "string" ? o.label : key;
      const minScore = typeof o.minScore === "number" ? o.minScore : Number(o.minScore);
      if (!key || !Number.isFinite(minScore)) continue;
      out.push({ key, label, minScore });
    }
    return out;
  }
  if (raw && typeof raw === "object" && "skills" in raw && Array.isArray((raw as { skills: unknown }).skills)) {
    const skills = (raw as { skills: string[] }).skills;
    return skills.map((s) => ({
      key: s.toLowerCase().replace(/\s+/g, "_"),
      label: s,
      minScore: 60,
    }));
  }
  return [];
}

export function parsePreferredCertificationIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}
