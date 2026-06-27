"use client";

import type { ReactElement } from "react";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AttackTimeline } from "@/components/training/attack-timeline";
import { HintButtonRow } from "@/components/training/hint-button";
import { CommandInput } from "@/components/training/command-input";
import { EnvironmentExplorer } from "@/components/training/environment-explorer";
import { EventLog } from "@/components/training/event-log";
import { FlagSubmission } from "@/components/training/flag-submission";
import { TrainingMobileTabs } from "@/components/training/mobile-tabs";
import { MentorPanel, type MentorMessageRow } from "@/components/training/mentor-panel";
import { ScenarioIntroModal } from "@/components/training/scenario-intro";
import { SessionCompletedModal } from "@/components/training/session-completed";
import { SessionInfo } from "@/components/training/session-info";
import {
  TrainingTerminal,
  formatTerminalCommand,
  formatTerminalOutput,
  type TerminalLine,
} from "@/components/training/terminal";
import {
  type InitialTrainingPayload,
  useTrainingSession,
} from "@/hooks/use-training-session";
import { useTimer } from "@/hooks/use-timer";
import type { AttackChain } from "@/lib/agents/adversary/attack-chain";

const PROMPT = "sentinelforge@lab:~$";

type TrainingSimulatorViewProps = {
  initial: InitialTrainingPayload;
  initialMentorMessages: MentorMessageRow[];
  initialAttackChain?: AttackChain | null;
};

export function TrainingSimulatorView({
  initial,
  initialMentorMessages,
  initialAttackChain = null,
}: TrainingSimulatorViewProps): ReactElement {
  const router = useRouter();
  const training = useTrainingSession(initial);
  const [introOpen, setIntroOpen] = useState(true);
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [cmdBusy, setCmdBusy] = useState(false);
  const [flagRecent, setFlagRecent] = useState<string[]>([]);
  const [resultsOpen, setResultsOpen] = useState(false);

  const elapsedLabel = useTimer(training.trainingStartedAt, !training.trainingStartedAt);

  const welcome = useMemo(
    () =>
      `Welcome to ${initial.scenarioName}.\n${initial.scenarioDescription}\nType 'help' for ideas, or 'clear' to reset the screen.`,
    [initial.scenarioDescription, initial.scenarioName],
  );

  const handleSubmit = useCallback(
    async (cmd: string) => {
      const trimmed = cmd.trim();
      if (trimmed.toLowerCase() === "clear") {
        setLines([]);
        return;
      }
      setCmdBusy(true);
      setLines((prev) => [...prev, formatTerminalCommand(trimmed, PROMPT)]);
      try {
        const result = await training.sendCommand(trimmed);
        setLines((prev) => [...prev, formatTerminalOutput(result.stdout, result.stderr, result.exitCode)]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Command error";
        setLines((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            plain: msg,
            html: `<span class="text-red-400">${msg}</span>`,
          },
        ]);
      } finally {
        setCmdBusy(false);
      }
    },
    [training],
  );

  const onBegin = () => {
    training.setTrainingStartedAt(Date.now());
    setIntroOpen(false);
  };

  const onFinishEarly = async () => {
    await training.finishSession();
    setResultsOpen(true);
  };

  const onAbort = async () => {
    await training.abortSession();
    router.push("/dashboard/scenarios");
  };

  const onFlagSubmit = async (flag: string) => {
    setFlagRecent((r) => [...r, flag].slice(-20));
    return training.submitFlag(flag);
  };

  const terminalSection = (
    <div className="flex min-h-[280px] flex-1 flex-col md:min-h-0">
      <TrainingTerminal
        lines={lines}
        welcome={welcome}
        footer={
          <CommandInput
            disabled={!training.isActive || !training.trainingStartedAt}
            busy={cmdBusy}
            onSubmit={(c) => void handleSubmit(c)}
          />
        }
      />
    </div>
  );

  const networkSection = (
    <div className="flex min-h-[200px] flex-1 flex-col md:min-h-0">
      <EnvironmentExplorer overview={training.environment} />
    </div>
  );

  const attackSection = (
    <div className="flex min-h-[160px] flex-1 flex-col md:min-h-0">
      <AttackTimeline
        sessionId={initial.sessionId}
        initialChain={initialAttackChain}
        isActive={training.isActive && Boolean(training.trainingStartedAt)}
      />
    </div>
  );

  const eventsSection = (
    <div className="flex min-h-[200px] flex-1 flex-col md:min-h-0">
      <EventLog events={training.events} />
    </div>
  );

  const mentorSection = (
    <div className="flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-lg border border-slate-800 md:min-h-0">
      <MentorPanel
        sessionId={initial.sessionId}
        initialMessages={initialMentorMessages}
        chatViaSocket={training.sendMentorChat}
      />
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-0 flex-col gap-3 overflow-hidden md:h-[calc(100dvh-6rem)]">
      <ScenarioIntroModal
        open={introOpen}
        scenarioName={initial.scenarioName}
        difficulty={initial.scenarioDifficulty}
        description={initial.scenarioDescription}
        estimatedMinutes={initial.scenarioEstMinutes}
        onBegin={onBegin}
      />

      <SessionCompletedModal
        open={resultsOpen}
        onOpenChange={setResultsOpen}
        breakdown={training.completedBreakdown}
        flagsFound={training.flagsFound}
        totalFlags={training.totalFlags}
      />

      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <TrainingMobileTabs
          terminal={terminalSection}
          network={networkSection}
          attack={attackSection}
          events={eventsSection}
          mentor={mentorSection}
        />
      </div>

      <div className="hidden min-h-0 flex-1 gap-3 overflow-hidden md:grid md:grid-cols-12">
        <div className="col-span-3 flex min-h-0 flex-col gap-3 overflow-hidden">
          {networkSection}
          {attackSection}
          {eventsSection}
        </div>
        <div className="col-span-6 flex min-h-0 flex-col gap-3 overflow-hidden">
          {terminalSection}
          <div className="shrink-0">
            <FlagSubmission
              flagsFound={training.flagsFound}
              totalFlags={training.totalFlags}
              disabled={!training.isActive || !training.trainingStartedAt}
              onSubmit={onFlagSubmit}
              recent={flagRecent}
            />
            <div className="mt-2">
              <HintButtonRow sessionId={initial.sessionId} />
            </div>
          </div>
        </div>
        <div className="col-span-3 flex min-h-0 flex-col gap-3 overflow-hidden">
          <SessionInfo
            scenarioName={initial.scenarioName}
            difficulty={initial.scenarioDifficulty}
            elapsedLabel={elapsedLabel}
            score={training.score}
            flagsFound={training.flagsFound}
            totalFlags={training.totalFlags}
            hintsUsed={training.hintsUsed}
            isActive={training.isActive}
            isConnected={training.isConnected}
            reconnectAttempt={training.reconnectAttempt}
            onAbort={onAbort}
            onFinishEarly={onFinishEarly}
          />
          {mentorSection}
        </div>
      </div>
    </div>
  );
}
