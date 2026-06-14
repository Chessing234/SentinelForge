"use client";

import { useEffect, useState } from "react";

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function useTimer(startedAtMs: number | null, paused = false): string {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (startedAtMs === null || paused) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [startedAtMs, paused]);

  if (startedAtMs === null) {
    return "00:00";
  }

  const elapsed = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  if (h > 0) {
    return `${h}:${pad2(m)}:${pad2(s)}`;
  }
  return `${pad2(m)}:${pad2(s)}`;
}

export function useElapsedSeconds(startedAtMs: number | null, paused = false): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (startedAtMs === null || paused) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAtMs, paused]);

  return startedAtMs === null || paused ? 0 : elapsed;
}
