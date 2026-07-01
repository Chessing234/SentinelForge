"use client";

import type { ReactElement } from "react";
import { useEffect } from "react";

import { log } from "@/lib/logger";

/**
 * Root-level error boundary. Catches errors thrown in the root layout itself,
 * so it must render its own <html>/<body>. Kept dependency-free (no shared UI
 * components) so it renders even if the failure is in shared modules.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  useEffect(() => {
    log.error("app.global-error.boundary", { digest: error.digest }, error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-semibold text-white">Something went wrong</h1>
            <p className="mt-3 text-sm text-slate-400">
              SentinelForge hit an unexpected error. Details were logged for the team.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => reset()}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Try again
              </button>
              <a
                href="/dashboard"
                className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800"
              >
                Go to dashboard
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
