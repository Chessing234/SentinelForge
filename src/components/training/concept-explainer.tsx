"use client";

import type { ReactElement } from "react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ConceptExplainerProps = {
  sessionId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topic: string | null;
};

export function ConceptExplainer({
  sessionId,
  open,
  onOpenChange,
  topic,
}: ConceptExplainerProps): ReactElement {
  const [body, setBody] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !topic) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetch("/api/agents/mentor/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sessionId, topic }),
        });
        const data = (await res.json()) as { explanation?: string; error?: string };
        if (!cancelled) {
          setBody(data.explanation ?? data.error ?? "No explanation returned.");
        }
      } catch {
        if (!cancelled) setBody("Could not load explanation.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, topic, sessionId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-slate-800 bg-slate-950 text-slate-100">
        <DialogHeader>
          <DialogTitle>{topic ?? "Concept"}</DialogTitle>
        </DialogHeader>
        {loading ? <p className="text-sm text-slate-400">Loading…</p> : null}
        <div className="space-y-4 text-sm leading-relaxed text-slate-200">
          <p className="whitespace-pre-wrap">{body}</p>
          <div className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-xs font-medium text-emerald-400/90">MITRE ATT&CK</p>
            <p className="mt-1 text-xs text-slate-400">
              Browse techniques at{" "}
              <a
                className="text-emerald-400 underline"
                href="https://attack.mitre.org/techniques/enterprise/"
                target="_blank"
                rel="noreferrer"
              >
                attack.mitre.org
              </a>
              . Map lab findings to tactics before picking exact technique IDs.
            </p>
            <div className="mt-2 rounded border border-slate-700 bg-slate-950/50 p-2">
              <p className="text-[10px] font-medium text-slate-400">Cyber kill chain</p>
              <svg
                viewBox="0 0 320 48"
                className="mt-1 h-12 w-full"
                role="img"
                aria-label="Kill chain: Initial Access, Execution, Persistence, Impact"
              >
                <defs>
                  <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                    <path d="M0,0 L6,3 L0,6 Z" fill="#64748b" />
                  </marker>
                </defs>
                {[
                  { x: 8, label: "Access", color: "#f87171" },
                  { x: 88, label: "Execution", color: "#fb923c" },
                  { x: 168, label: "Persistence", color: "#fbbf24" },
                  { x: 248, label: "Impact", color: "#34d399" },
                ].map((stage, i) => (
                  <g key={stage.label}>
                    <rect
                      x={stage.x}
                      y="12"
                      width="64"
                      height="24"
                      rx="4"
                      fill={stage.color}
                      fillOpacity="0.15"
                      stroke={stage.color}
                      strokeWidth="1"
                    />
                    <text
                      x={stage.x + 32}
                      y="28"
                      textAnchor="middle"
                      fill={stage.color}
                      fontSize="9"
                      fontFamily="system-ui, sans-serif"
                    >
                      {stage.label}
                    </text>
                    {i < 3 ? (
                      <line
                        x1={stage.x + 64}
                        y1="24"
                        x2={stage.x + 80}
                        y2="24"
                        stroke="#64748b"
                        strokeWidth="1"
                        markerEnd="url(#arrow)"
                      />
                    ) : null}
                  </g>
                ))}
              </svg>
            </div>
          </div>
        </div>
        <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
          Close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
