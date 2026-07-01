/**
 * Boot-time seed guard (idempotent).
 *
 * Runs during container start (see scripts/docker-entrypoint.sh). If the demo
 * data is already present it exits immediately so cold starts stay fast;
 * otherwise it runs the base seed followed by the enhanced seed.
 *
 * Seeding failures are logged but never abort startup — the app must boot even
 * if the demo data cannot be populated.
 */
import { spawn } from "node:child_process";

import { and, count, eq } from "drizzle-orm";

import { db, postgresClient } from "@/db";
import { trainingSessions, users } from "@/db/schema";

const REQUIRED_COMPLETED_SESSIONS = 8;

function run(script: string): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn("node_modules/.bin/tsx", [script], {
      cwd: process.cwd(),
      stdio: "inherit",
      env: process.env,
    });
    child.on("close", (code) => resolve(code === 0));
    child.on("error", (err) => {
      console.error(`[seed] failed to spawn ${script}:`, err);
      resolve(false);
    });
  });
}

async function alreadySeeded(): Promise<boolean> {
  const demo = await db.query.users.findFirst({
    where: eq(users.email, "student1@state.edu"),
  });
  if (!demo) return false;
  const [{ c }] = await db
    .select({ c: count() })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.userId, demo.id),
        eq(trainingSessions.status, "completed"),
      ),
    );
  return Number(c) >= REQUIRED_COMPLETED_SESSIONS;
}

async function main(): Promise<void> {
  let seeded = false;
  try {
    seeded = await alreadySeeded();
  } catch (err) {
    console.warn("[seed] could not verify seed state (continuing to seed):", err);
  }
  // Release this script's own pool before the child seed scripts open theirs.
  await postgresClient.end({ timeout: 5 }).catch(() => undefined);

  if (seeded) {
    console.log("[seed] Demo data already present — skipping seed.");
    return;
  }

  console.log("[seed] Populating demo data (base + enhanced)...");
  const baseOk = await run("src/db/seed.ts");
  if (!baseOk) {
    console.error("[seed] base seed failed; skipping enhanced seed.");
    return;
  }
  const enhancedOk = await run("src/db/enhanced-seed.ts");
  console.log(
    enhancedOk
      ? "[seed] Demo data ready."
      : "[seed] enhanced seed failed (base seed applied).",
  );
}

main()
  .catch((err) => {
    console.error("[seed] unexpected error:", err);
  })
  .finally(() => {
    process.exit(0);
  });
