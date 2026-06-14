"use client";

import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type HintApi = {
  level: 1 | 2 | 3;
  content: string;
  type: string;
};

type HintButtonProps = {
  sessionId: number;
};

export function HintButtonRow({ sessionId }: HintButtonProps): ReactElement {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<HintApi | null>(null);
  const [usedLevels, setUsedLevels] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadMeta = useCallback(async () => {
    const res = await fetch(`/api/agents/mentor/hint?sessionId=${sessionId}`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { usedLevels?: number[] };
    setUsedLevels(data.usedLevels ?? []);
  }, [sessionId]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const fetchHint = async (level: 1 | 2 | 3) => {
    setError(null);
    const res = await fetch(`/api/agents/mentor/hint?sessionId=${sessionId}&level=${level}`, {
      credentials: "include",
    });
    const data = (await res.json()) as {
      hint?: HintApi;
      usedLevels?: number[];
      error?: string;
    };
    if (!res.ok) {
      setError(data.error ?? "Could not load hint");
      if (data.usedLevels) setUsedLevels(data.usedLevels);
      return;
    }
    if (data.hint) {
      setActive(data.hint);
      setOpen(true);
      setUsedLevels(data.usedLevels ?? []);
      await loadMeta();
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Hints used: {usedLevels.length}</span>
        {([1, 2, 3] as const).map((lvl) => (
          <Button
            key={lvl}
            type="button"
            variant="outline"
            size="sm"
            className="h-8 border-slate-700 text-xs text-slate-200"
            disabled={usedLevels.includes(lvl)}
            onClick={() => void fetchHint(lvl)}
          >
            Hint {lvl}
          </Button>
        ))}
      </div>
      {error ? <p className="text-xs text-amber-400">{error}</p> : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>Hint {active?.level ?? ""}</DialogTitle>
          </DialogHeader>
          <p
            className={
              active?.level === 1
                ? "text-sm italic text-slate-300/80"
                : active?.level === 2
                  ? "text-sm text-slate-200/95"
                  : "text-sm font-medium text-white"
            }
          >
            {active?.content}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
