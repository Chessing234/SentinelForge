import { Shield, Zap } from "lucide-react";
import type { ReactElement } from "react";

export default function Loading(): ReactElement {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center bg-slate-950 text-slate-100">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-xl bg-emerald-600/20 ring-1 ring-emerald-500/40">
        <Shield className="h-8 w-8 animate-pulse text-emerald-400" aria-hidden />
        <Zap className="absolute -bottom-1 -right-1 h-5 w-5 text-amber-300 motion-safe:animate-spin" aria-hidden />
      </div>
      <p className="mt-6 text-sm font-medium text-slate-400">Loading SentinelForge…</p>
      <div className="mt-8 h-2 w-48 overflow-hidden rounded-full bg-slate-800">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-emerald-500/70" />
      </div>
      <div className="mt-6 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
        <div className="h-24 animate-pulse rounded-lg bg-slate-900/80" />
        <div className="h-24 animate-pulse rounded-lg bg-slate-900/80" />
        <div className="h-24 animate-pulse rounded-lg bg-slate-900/80" />
      </div>
    </div>
  );
}
