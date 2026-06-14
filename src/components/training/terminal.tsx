"use client";

import type { ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ansiToSafeHtml } from "@/lib/training/ansi";
import { Copy } from "lucide-react";

export type TerminalLine = {
  id: string;
  /** Raw text for copy / clear */
  plain: string;
  /** When set, rendered as HTML (already escaped + ANSI) */
  html?: string;
};

type TrainingTerminalProps = {
  lines: TerminalLine[];
  welcome: string;
  footer?: ReactNode;
  disabled?: boolean;
};

export function TrainingTerminal({
  lines,
  welcome,
  footer,
  disabled,
}: TrainingTerminalProps): ReactElement {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const copySelection = useCallback(async () => {
    const sel = window.getSelection()?.toString();
    if (sel) {
      await navigator.clipboard.writeText(sel);
      return;
    }
    const all = [welcome, ...lines.map((l) => l.plain)].join("\n");
    await navigator.clipboard.writeText(all);
  }, [lines, welcome]);

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-800 bg-[#0a0a0a]">
      <div className="flex items-center justify-end gap-2 border-b border-slate-800/80 px-2 py-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-slate-400 hover:text-emerald-300"
          onClick={() => void copySelection()}
        >
          <Copy className="mr-1 h-3 w-3" />
          Copy
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1 p-3 font-mono text-sm leading-relaxed">
        <div className="text-emerald-400/90">
          <p className="mb-3 whitespace-pre-wrap text-slate-500">{welcome}</p>
          {lines.map((line) => (
            <div key={line.id} className="mb-1 break-words text-emerald-300/95">
              {line.html ? (
                <span dangerouslySetInnerHTML={{ __html: line.html }} />
              ) : (
                <span className="whitespace-pre-wrap">{line.plain}</span>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      {footer ? (
        <div className={`border-t border-slate-800/80 p-2 ${disabled ? "opacity-50" : ""}`}>{footer}</div>
      ) : null}
    </div>
  );
}

export function formatTerminalCommand(cmd: string, prefix: string): TerminalLine {
  return {
    id: `cmd-${Date.now()}-${Math.random()}`,
    plain: `${prefix} ${cmd}`,
    html: `<span class="text-emerald-400">${prefix}</span> <span class="text-slate-200">${escapeHtml(cmd)}</span>`,
  };
}

export function formatTerminalOutput(stdout: string, stderr: string, exitCode: number): TerminalLine {
  const plain = [stdout, stderr, exitCode !== 0 ? `[exit ${exitCode}]` : ""].filter(Boolean).join("\n");
  const combined = [stdout, stderr].filter(Boolean).join("\n");
  const html = ansiToSafeHtml(combined + (exitCode !== 0 ? `\n[exit ${exitCode}]` : ""));
  return {
    id: `out-${Date.now()}-${Math.random()}`,
    plain,
    html,
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
