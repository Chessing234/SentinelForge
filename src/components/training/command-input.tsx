"use client";

import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

const MAX_LEN = 500;

const SUGGESTIONS = [
  "nmap -sn 192.168.1.0/24",
  "netstat -an",
  "ps aux",
  "ls -la /tmp",
  "ssh admin@192.168.1.10",
  "cat /etc/passwd",
];

type CommandInputProps = {
  promptPrefix?: string;
  disabled?: boolean;
  busy?: boolean;
  onSubmit: (cmd: string) => void | Promise<void>;
};

export function CommandInput({
  promptPrefix = "sentinelforge@lab:~$",
  disabled,
  busy,
  onSubmit,
}: CommandInputProps): ReactElement {
  const [value, setValue] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!busy) {
      inputRef.current?.focus();
    }
  }, [busy]);

  const run = async () => {
    const cmd = value.trim();
    if (!cmd || cmd.length > MAX_LEN || disabled || busy) return;
    setHistory((h) => [...h, cmd].slice(-100));
    setHistIdx(null);
    setValue("");
    await onSubmit(cmd);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const next =
        histIdx === null ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(next);
      setValue(history[next] ?? "");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx === null) return;
      const next = histIdx + 1;
      if (next >= history.length) {
        setHistIdx(null);
        setValue("");
      } else {
        setHistIdx(next);
        setValue(history[next] ?? "");
      }
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const partial = value.trim().toLowerCase();
      const hit = SUGGESTIONS.find((s) => s.toLowerCase().startsWith(partial));
      if (hit) setValue(hit);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      void run();
    }
  };

  return (
    <div className="flex items-center gap-2 bg-[#050505] px-2 py-2">
      <span className="shrink-0 font-mono text-sm text-emerald-400">{promptPrefix}</span>
      <Input
        ref={inputRef}
        value={value}
        disabled={disabled || busy}
        onChange={(e) => setValue(e.target.value.slice(0, MAX_LEN))}
        onKeyDown={onKeyDown}
        placeholder={disabled ? "Session inactive" : "Enter command…"}
        className="border-slate-800 bg-black font-mono text-sm text-emerald-100 placeholder:text-slate-600"
      />
      <Button
        type="button"
        size="icon"
        disabled={disabled || busy || !value.trim()}
        className="shrink-0 bg-emerald-700 text-white hover:bg-emerald-600"
        onClick={() => void run()}
        aria-label="Run command"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="text-xs">↵</span>}
      </Button>
    </div>
  );
}
