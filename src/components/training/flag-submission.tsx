"use client";

import type { ReactElement } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";

type FlagSubmissionProps = {
  flagsFound: number;
  totalFlags: number;
  disabled?: boolean;
  onSubmit: (flag: string) => Promise<boolean>;
  recent: string[];
};

export function FlagSubmission({
  flagsFound,
  totalFlags,
  disabled,
  onSubmit,
  recent,
}: FlagSubmissionProps): ReactElement {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<"ok" | "bad" | null>(null);

  const submit = async () => {
    const f = value.trim();
    if (!f || disabled || busy) return;
    setBusy(true);
    setFlash(null);
    try {
      const ok = await onSubmit(f);
      setFlash(ok ? "ok" : "bad");
      if (ok) {
        setValue("");
        window.setTimeout(() => setFlash(null), 2000);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
      <p className="text-xs font-medium text-slate-300">Flags</p>
      <p className="mt-1 text-[11px] text-slate-500">
        Format: <span className="font-mono text-emerald-400">SF{"{...}"}</span>
      </p>
      <p className="mt-2 text-sm text-white">
        {flagsFound} of {totalFlags} found
      </p>
      <div className="mt-2 flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={disabled || busy}
          placeholder="SF{...}"
          className="border-slate-700 bg-black font-mono text-sm text-emerald-100"
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
        />
        <Button
          type="button"
          size="sm"
          className="bg-emerald-600 text-white"
          disabled={disabled || busy || !value.trim()}
          onClick={() => void submit()}
        >
          Submit
        </Button>
      </div>
      {flash === "ok" ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
          <Check className="h-4 w-4" /> Correct flag
        </p>
      ) : null}
      {flash === "bad" ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-red-400">
          <X className="h-4 w-4" /> Try again
        </p>
      ) : null}
      {recent.length > 0 ? (
        <ul className="mt-2 space-y-1 text-[10px] text-slate-500">
          {recent.slice(-5).map((r, i) => (
            <li key={`${r}-${i}`} className="truncate font-mono">
              {r}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
