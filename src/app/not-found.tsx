import Link from "next/link";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";

export default function NotFound(): ReactElement {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-500">SentinelForge</p>
        <h1 className="mt-4 text-4xl font-bold text-white">404</h1>
        <p className="mt-2 text-lg text-slate-300">Page not found</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          The page you requested does not exist or was moved.
        </p>
        <div
          className="mt-8 text-6xl motion-safe:animate-bounce"
          aria-hidden
        >
          🛡️
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Button asChild className="bg-emerald-600 hover:bg-emerald-500">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
          <Button asChild variant="outline" className="border-slate-600">
            <Link href="/dashboard/training">Training</Link>
          </Button>
          <Button asChild variant="outline" className="border-slate-600">
            <Link href="/dashboard/scenarios">Scenarios</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
