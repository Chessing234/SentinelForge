import Link from "next/link";
import type { ReactElement } from "react";

export default function HomePage(): ReactElement {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="container flex flex-col items-center gap-8 py-16 text-center md:py-24">
        <div className="space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl">
            SentinelForge
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground md:text-xl">
            The Autonomous Cybersecurity Apprenticeship Platform
          </p>
        </div>
        <div className="grid w-full max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <article className="rounded-lg border border-border bg-card p-6 text-left shadow-sm">
            <h2 className="mb-2 text-xl font-semibold text-card-foreground">
              AI-Powered Training
            </h2>
            <p className="text-muted-foreground">
              Hands-on labs and adaptive scenarios powered by modern AI so you
              learn by doing, not by skimming slides.
            </p>
          </article>
          <article className="rounded-lg border border-border bg-card p-6 text-left shadow-sm">
            <h2 className="mb-2 text-xl font-semibold text-card-foreground">
              Enterprise-Grade
            </h2>
            <p className="text-muted-foreground">
              Built for teams that need auditability, structured curricula, and
              outcomes that map to real security operations.
            </p>
          </article>
          <article className="rounded-lg border border-border bg-card p-6 text-left shadow-sm sm:col-span-2 lg:col-span-1">
            <h2 className="mb-2 text-xl font-semibold text-card-foreground">
              Job Placement
            </h2>
            <p className="text-muted-foreground">
              Progress from fundamentals to job-ready skills with clear
              milestones and portfolio-worthy projects.
            </p>
          </article>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-md bg-accent px-8 py-3 text-sm font-medium text-accent-foreground shadow transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Get Started
        </Link>
      </section>
    </main>
  );
}
