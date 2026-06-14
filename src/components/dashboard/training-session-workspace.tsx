"use client";

import type { ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ConceptExplainer } from "@/components/training/concept-explainer";
import { HintButtonRow } from "@/components/training/hint-button";
import {
  MentorPanel,
  type MentorMessageRow,
} from "@/components/training/mentor-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { EnvironmentOverview } from "@/lib/agents/environment/overview";
import { toOverview } from "@/lib/agents/environment/overview";
import type { CommandResult } from "@/lib/agents/types";

type SessionEventRow = {
  id: number;
  eventType: string;
  payload: unknown;
  createdAt: string;
};

type TrainingSessionWorkspaceProps = {
  sessionId: number;
  initialOverview: EnvironmentOverview | null;
  initialEvents: SessionEventRow[];
  initialMentorMessages: MentorMessageRow[];
  sessionStatus: string;
  initialFinalScore: number | null;
};

export function TrainingSessionWorkspace({
  sessionId,
  initialOverview,
  initialEvents,
  initialMentorMessages,
  sessionStatus,
  initialFinalScore,
}: TrainingSessionWorkspaceProps): ReactElement {
  const router = useRouter();
  const [overview, setOverview] = useState<EnvironmentOverview | null>(initialOverview);
  const [events, setEvents] = useState<SessionEventRow[]>(initialEvents);
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [scored, setScored] = useState(
    sessionStatus === "completed" && initialFinalScore != null,
  );
  const [lastScore, setLastScore] = useState<number | null>(initialFinalScore);
  const [conceptOpen, setConceptOpen] = useState(false);
  const [conceptTopic, setConceptTopic] = useState<string | null>(null);

  const refreshState = useCallback(async () => {
    const res = await fetch(`/api/agents/environment/state?sessionId=${sessionId}`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { topology?: import("@/lib/agents/types").NetworkTopology };
    if (data.topology) {
      setOverview(toOverview(data.topology));
    }
  }, [sessionId]);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  const runCommand = async () => {
    const cmd = command.trim();
    if (!cmd) return;
    setBusy(true);
    try {
      const res = await fetch("/api/agents/environment/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId, command: cmd }),
      });
      const data = (await res.json()) as { result?: CommandResult; error?: string };
      if (!res.ok) {
        setOutput((o) => `${o}\n$ ${cmd}\n[error] ${data.error ?? res.statusText}\n`);
        return;
      }
      const r = data.result;
      if (r) {
        const block = [
          `$ ${cmd}`,
          r.stdout ? r.stdout : "",
          r.stderr ? r.stderr : "",
          r.exitCode !== 0 ? `[exit ${r.exitCode}]` : "",
        ]
          .filter(Boolean)
          .join("\n");
        setOutput((o) => `${o}\n${block}\n`);
      }
      setCommand("");
      await refreshState();
      setEvents((prev) => [
        ...prev,
        {
          id: Date.now(),
          eventType: "milestone_reached",
          payload: { command: cmd },
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const completeSession = async () => {
    setCompleting(true);
    try {
      const res = await fetch("/api/agents/evaluator/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sessionId }),
      });
      const data = (await res.json()) as { breakdown?: { totalScore: number }; error?: string };
      if (!res.ok) {
        setOutput((o) => `${o}\n[complete session] ${data.error ?? res.statusText}\n`);
        return;
      }
      if (data.breakdown) {
        setScored(true);
        setLastScore(data.breakdown.totalScore);
      }
      router.push("/dashboard/progress");
      router.refresh();
    } finally {
      setCompleting(false);
    }
  };

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        {!scored ? (
          <Button
            type="button"
            variant="secondary"
            disabled={completing}
            className="bg-slate-800 text-white hover:bg-slate-700"
            onClick={() => void completeSession()}
          >
            {completing ? "Scoring…" : "Complete session & get score"}
          </Button>
        ) : (
          <p className="text-sm text-slate-400">
            Scored{lastScore != null ? `: ${lastScore}/100` : ""}.{" "}
            <Link href="/dashboard/progress" className="text-emerald-400 underline-offset-2 hover:underline">
              View progress
            </Link>
          </p>
        )}
        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="border-emerald-700/50 text-emerald-200">
              Open Mentor
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="flex w-full flex-col border-slate-800 bg-slate-950 p-0 sm:max-w-md"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Mentor</SheetTitle>
            </SheetHeader>
            <MentorPanel
              sessionId={sessionId}
              initialMessages={initialMentorMessages}
              onOpenConcept={(t) => {
                setConceptTopic(t);
                setConceptOpen(true);
              }}
            />
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader>
              <CardTitle className="text-lg text-white">Environment</CardTitle>
              <p className="text-sm text-slate-400">
                Session #{sessionId} — discovered topology (overview). Use the terminal to probe
                further.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview ? (
                <>
                  <p className="text-xs text-slate-500">
                    {overview.hostCount} host(s) · subnets vary by scenario template
                  </p>
                  <ul className="space-y-2 text-sm">
                    {overview.hosts.map((h) => (
                      <li
                        key={h.id}
                        className="rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2"
                      >
                        <span className="font-mono text-emerald-300">{h.ip}</span>{" "}
                        <span className="text-slate-200">{h.hostname}</span>
                        <span className="block text-xs text-slate-500">{h.os}</span>
                        <span className="text-xs text-slate-500">
                          Ports: {h.openPorts.join(", ") || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-amber-300/90">
                  No live in-memory environment (server may have restarted). Re-launch from the
                  scenario browser or POST /api/agents/environment/initialize again.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader>
              <CardTitle className="text-lg text-white">Terminal (preview)</CardTitle>
              <p className="text-xs text-slate-500">
                Expanded shell UI ships in Prompt 9. Commands are case-insensitive.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ScrollArea className="h-56 rounded-md border border-slate-800 bg-black/60 p-3 font-mono text-xs text-emerald-100">
                <pre className="whitespace-pre-wrap">{output || "Ready.\n"}</pre>
              </ScrollArea>
              <div className="flex gap-2">
                <Input
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void runCommand();
                  }}
                  placeholder="nmap 192.168.1.0/24  |  cat /etc/passwd  |  flag SF{...}"
                  className="border-slate-700 bg-slate-950 font-mono text-sm text-slate-100"
                />
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void runCommand()}
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  Run
                </Button>
              </div>
              <HintButtonRow sessionId={sessionId} />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit border-slate-800 bg-slate-900/50 lg:sticky lg:top-24">
          <CardHeader>
            <CardTitle className="text-base text-white">Event log</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[480px] pr-3">
              <ul className="space-y-2 text-xs">
                {events.map((ev) => (
                  <li key={ev.id} className="rounded border border-slate-800/80 bg-slate-950/50 p-2">
                    <p className="font-medium text-emerald-400/90">{ev.eventType}</p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(ev.createdAt).toLocaleString()}
                    </p>
                    <Separator className="my-1 bg-slate-800" />
                    <pre className="whitespace-pre-wrap break-all text-slate-400">
                      {JSON.stringify(ev.payload, null, 0).slice(0, 400)}
                    </pre>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <ConceptExplainer
        sessionId={sessionId}
        open={conceptOpen}
        onOpenChange={setConceptOpen}
        topic={conceptTopic}
      />
    </>
  );
}
