"use client";

import type { ReactElement } from "react";
import { useMemo, useState } from "react";

import type { EnvironmentOverview } from "@/lib/agents/environment/overview";

type HostStatus = "unknown" | "discovered" | "compromised" | "investigating";

type EnvironmentExplorerProps = {
  overview: EnvironmentOverview | null;
};

export function EnvironmentExplorer({ overview }: EnvironmentExplorerProps): ReactElement {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const hosts = overview?.hosts ?? [];
  const selected = hosts.find((h) => h.id === selectedId) ?? null;

  const layout = useMemo(() => {
    const n = Math.max(hosts.length, 1);
    const cols = Math.ceil(Math.sqrt(n));
    return { cols };
  }, [hosts.length]);

  function statusForHost(h: (typeof hosts)[0]): HostStatus {
    if (h.compromised) return "compromised";
    return "discovered";
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-800 bg-slate-950/60">
      <div className="border-b border-slate-800 px-3 py-2">
        <p className="text-xs font-medium text-slate-300">Network map</p>
        <ul className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500">
          <li>
            <span className="mr-1 inline-block h-2 w-2 rounded bg-slate-600" /> Unknown
          </li>
          <li>
            <span className="mr-1 inline-block h-2 w-2 rounded bg-emerald-500" /> Discovered
          </li>
          <li>
            <span className="mr-1 inline-block h-2 w-2 rounded bg-red-500" /> Compromised
          </li>
          <li>
            <span className="mr-1 inline-block h-2 w-2 rounded bg-amber-400" /> Investigating
          </li>
        </ul>
      </div>
      <div className="min-h-[180px] flex-1 overflow-auto p-2">
        {hosts.length === 0 ? (
          <p className="p-4 text-center text-xs text-slate-500">No topology yet.</p>
        ) : (
          <svg
            viewBox="0 0 400 260"
            className="h-full w-full max-h-[220px] text-[10px]"
            role="img"
            aria-label="Network topology"
          >
            {hosts.map((h, i) => {
              const col = i % layout.cols;
              const row = Math.floor(i / layout.cols);
              const x = 40 + col * 110;
              const y = 40 + row * 90;
              const st = statusForHost(h);
              const fill =
                st === "compromised"
                  ? "#ef4444"
                  : st === "discovered"
                    ? "#34d399"
                    : st === "investigating"
                      ? "#fbbf24"
                      : "#64748b";
              return (
                <g key={h.id} className="cursor-pointer" onClick={() => setSelectedId(h.id)}>
                  <rect
                    x={x - 45}
                    y={y - 28}
                    width={90}
                    height={56}
                    rx={6}
                    fill={fill}
                    fillOpacity={0.25}
                    stroke={fill}
                    strokeWidth={1}
                    className="animate-in fade-in duration-500"
                  />
                  <text x={x} y={y - 8} textAnchor="middle" fill="#e2e8f0">
                    {h.hostname}
                  </text>
                  <text x={x} y={y + 8} textAnchor="middle" fill="#94a3b8" className="font-mono">
                    {h.ip}
                  </text>
                </g>
              );
            })}
            {hosts.map((_, i) => {
              if (i === 0) return null;
              return (
                <line
                  key={`link-${i}`}
                  x1={40 + ((i - 1) % layout.cols) * 110}
                  y1={40 + Math.floor((i - 1) / layout.cols) * 90}
                  x2={40 + (i % layout.cols) * 110}
                  y2={40 + Math.floor(i / layout.cols) * 90}
                  stroke="#334155"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                />
              );
            })}
          </svg>
        )}
      </div>
      {selected ? (
        <div className="border-t border-slate-800 p-3 text-xs text-slate-300">
          <p className="font-semibold text-white">{selected.hostname}</p>
          <p className="font-mono text-emerald-400">{selected.ip}</p>
          <p className="mt-1 text-slate-500">{selected.os}</p>
          <p className="mt-1 text-slate-400">Ports: {selected.openPorts.join(", ") || "—"}</p>
        </div>
      ) : null}
    </div>
  );
}
