"use client";

import Link from "next/link";
import type { ReactElement } from "react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { log } from "@/lib/logger";

/**
 * Segment-level error boundary. Renders inside the root layout, so it must NOT
 * include <html>/<body> (see global-error.tsx for the root layout boundary).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): ReactElement {
  useEffect(() => {
    log.error("app.error.boundary", { digest: error.digest }, error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold text-foreground">Something went wrong</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This section hit an unexpected error. Details were logged for the team.
          {error.digest ? (
            <span className="mt-1 block font-mono text-xs text-muted-foreground/70">
              Ref: {error.digest}
            </span>
          ) : null}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            type="button"
            className="bg-emerald-600 hover:bg-emerald-500"
            onClick={() => reset()}
          >
            Try again
          </Button>
          <Button type="button" variant="outline" className="border-slate-600" asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
