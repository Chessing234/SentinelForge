import { subDays } from "date-fns";
import { and, count, eq, gte } from "drizzle-orm";

import { db } from "@/db/index";
import { listActiveSlackIntegrations } from "@/db/queries";
import { trainingSessions, users } from "@/db/schema";
import { drainSlackRetryQueue, slackNotificationService } from "@/lib/slack/notifications";

let intervalId: ReturnType<typeof setInterval> | undefined;
let lastDigestKey = "";
let lastLeaderKey = "";
let lastInactiveKey = "";

function weekKey(d: Date): string {
  return `${d.getUTCFullYear()}-W${Math.ceil((d.getUTCDate() + 6 - d.getUTCDay()) / 7)}`;
}

async function maybeWeeklyDigest(now: Date): Promise<void> {
  if (now.getUTCDay() !== 1 || now.getUTCHours() !== 9) return;
  const key = `${weekKey(now)}-digest`;
  if (key === lastDigestKey) return;
  lastDigestKey = key;
  const rows = await listActiveSlackIntegrations();
  for (const row of rows) {
    await slackNotificationService.notifyWeeklyDigest(row.organizationId).catch(() => undefined);
  }
}

async function maybeLeaderboard(now: Date): Promise<void> {
  if (now.getUTCDay() !== 5 || now.getUTCHours() !== 16) return;
  const key = `${weekKey(now)}-leader`;
  if (key === lastLeaderKey) return;
  lastLeaderKey = key;
  const rows = await listActiveSlackIntegrations();
  for (const row of rows) {
    await slackNotificationService.postLeaderboard(row.organizationId).catch(() => undefined);
  }
}

async function maybeInactiveReminders(now: Date): Promise<void> {
  if (now.getUTCHours() !== 12) return;
  const dayKey = `${now.toISOString().slice(0, 10)}-inactive`;
  if (dayKey === lastInactiveKey) return;
  lastInactiveKey = dayKey;
  const cutoff = subDays(now, 7);
  const rows = await listActiveSlackIntegrations();
  for (const integ of rows) {
    const members = await db.query.users.findMany({
      where: eq(users.organizationId, integ.organizationId),
      columns: { id: true },
    });
    for (const u of members) {
      const [{ c }] = await db
        .select({ c: count() })
        .from(trainingSessions)
        .where(and(eq(trainingSessions.userId, u.id), gte(trainingSessions.createdAt, cutoff)));
      if (Number(c) > 0) continue;
      await slackNotificationService
        .sendDirectMessage(
          u.id,
          "You have not trained on SentinelForge in 7 days. Open the Training tab when you have a few minutes.",
        )
        .catch(() => undefined);
    }
  }
}

export function startSlackScheduler(): void {
  if (intervalId) return;
  intervalId = setInterval(() => {
    const now = new Date();
    void maybeWeeklyDigest(now);
    void maybeLeaderboard(now);
    void maybeInactiveReminders(now);
    drainSlackRetryQueue();
  }, 60_000);
}

export function stopSlackScheduler(): void {
  if (intervalId) clearInterval(intervalId);
  intervalId = undefined;
}
