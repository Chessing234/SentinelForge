"use client";

import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ScenarioIntroProps = {
  open: boolean;
  scenarioName: string;
  difficulty: string;
  description: string;
  estimatedMinutes: number;
  onBegin: () => void;
};

export function ScenarioIntroModal({
  open,
  scenarioName,
  difficulty,
  description,
  estimatedMinutes,
  onBegin,
}: ScenarioIntroProps): ReactElement {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="border-slate-800 bg-slate-950 text-slate-100 sm:max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl text-white">{scenarioName}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 text-left text-slate-300">
              <p className="text-xs uppercase text-slate-500">Difficulty</p>
              <p className="capitalize text-emerald-300">{difficulty}</p>
              <p className="text-sm leading-relaxed">{description}</p>
              <p className="text-xs text-slate-500">Estimated duration: ~{estimatedMinutes} min</p>
              <p className="text-xs text-slate-500">
                Tools: nmap, ssh, netstat, ps, cat, grep, find — behave as in a Linux SOC lab.
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" className="w-full bg-emerald-600 hover:bg-emerald-500" onClick={onBegin}>
            Begin training
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
