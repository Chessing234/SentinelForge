"use client";

import Link from "next/link";
import type { ReactElement } from "react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { log } from "@/lib/logger";

export default function GlobalError({
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
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center px-4">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-semibold text-white">Something went wrong</h1>
            <p className="mt-3 text-sm text-slate-400">
              SentinelForge hit an unexpected error. Details were logged for your team.
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
      </body>
    </html>
  );
}
