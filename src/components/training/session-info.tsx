"use client";

import type { ReactElement } from "react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Wifi, WifiOff } from "lucide-react";

type SessionInfoProps = {
  scenarioName: string;
  difficulty: string;
  elapsedLabel: string;
  score: number;
  flagsFound: number;
  totalFlags: number;
  hintsUsed: number;
  isActive: boolean;
  isConnected: boolean;
  reconnectAttempt: number;
  onAbort: () => Promise<void>;
  onFinishEarly: () => Promise<void>;
};

export function SessionInfo({
  scenarioName,
  difficulty,
  elapsedLabel,
  score,
  flagsFound,
  totalFlags,
  hintsUsed,
  isActive,
  isConnected,
  reconnectAttempt,
  onAbort,
  onFinishEarly,
}: SessionInfoProps): ReactElement {
  const [abortOpen, setAbortOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [busy, setBusy] = useState<"abort" | "finish" | null>(null);

  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">Scenario</p>
        <p className="font-semibold text-white">{scenarioName}</p>
        <span className="mt-1 inline-block rounded bg-slate-800 px-2 py-0.5 text-[10px] capitalize text-emerald-300">
          {difficulty}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-400">
        {isConnected ? (
          <Wifi className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
        ) : (
          <WifiOff className="h-3.5 w-3.5 text-amber-400" aria-hidden />
        )}
        <span>{isConnected ? "Live socket" : "Reconnecting…"}</span>
        {!isConnected && reconnectAttempt > 0 ? (
          <span className="text-amber-300">({reconnectAttempt})</span>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-slate-500">Elapsed</p>
          <p className="font-mono text-emerald-300">{elapsedLabel}</p>
        </div>
        <div>
          <p className="text-slate-500">Est. score</p>
          <p className="font-mono text-white">{score}</p>
        </div>
        <div>
          <p className="text-slate-500">Flags</p>
          <p className="font-mono text-white">
            {flagsFound} / {totalFlags}
          </p>
        </div>
        <div>
          <p className="text-slate-500">Hints</p>
          <p className="font-mono text-amber-200">{hintsUsed}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-amber-800 text-amber-200"
          disabled={!isActive || busy !== null}
          onClick={() => setFinishOpen(true)}
        >
          Finish early
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={!isActive || busy !== null}
          onClick={() => setAbortOpen(true)}
        >
          Abort session
        </Button>
      </div>

      <Dialog open={abortOpen} onOpenChange={setAbortOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>Abort training?</DialogTitle>
            <DialogDescription className="text-slate-400">
              Progress will be saved as abandoned. You can start a new session later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="secondary" onClick={() => setAbortOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy !== null}
              onClick={() => {
                setBusy("abort");
                void (async () => {
                  try {
                    await onAbort();
                  } finally {
                    setBusy(null);
                    setAbortOpen(false);
                  }
                })();
              }}
            >
              {busy === "abort" ? "Aborting…" : "Confirm abort"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={finishOpen} onOpenChange={setFinishOpen}>
        <DialogContent className="border-slate-800 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>Finish and score?</DialogTitle>
            <DialogDescription className="text-slate-400">
              We will evaluate your session now using the evaluator agent.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button type="button" variant="secondary" onClick={() => setFinishOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-500"
              disabled={busy !== null}
              onClick={() => {
                setBusy("finish");
                void (async () => {
                  try {
                    await onFinishEarly();
                  } finally {
                    setBusy(null);
                    setFinishOpen(false);
                  }
                })();
              }}
            >
              {busy === "finish" ? "Scoring…" : "Finish & score"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
