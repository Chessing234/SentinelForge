import {
  getOrganizationById,
  getSessionById,
  getSlackIntegrationByOrganizationId,
  getUserById,
} from "@/db/queries";
import { getOrganizationAnalytics, getTeamProgress } from "@/lib/agents/evaluator/analytics";
import { createSlackClient } from "@/lib/slack/client";
import {
  flagFoundBlock,
  incidentSimulationBlock,
  sessionCompleteBlock,
  teamLeaderboardBlock,
  trainingStartBlock,
  weeklyDigestBlock,
  type LeaderboardRow,
} from "@/lib/slack/blocks";
import { decryptSlackToken } from "@/lib/slack/token-crypto";

import type { KnownBlock } from "@slack/web-api";

type SlackNotifSettings = {
  trainingStarted?: boolean;
  flagFound?: boolean;
  sessionCompleted?: boolean;
  weeklyDigest?: boolean;
  incidentSimulations?: boolean;
};

function readSettings(raw: unknown): SlackNotifSettings {
  if (raw && typeof raw === "object") return raw as SlackNotifSettings;
  return {};
}

const rateWindowMs = 60 * 60 * 1000;
const rateMax = 5;
const rateMap = new Map<string, { count: number; resetAt: number }>();

export const slackRetryQueue: Array<() => Promise<void>> = [];

function rateAllowed(userId: number): boolean {
  const key = String(userId);
  const now = Date.now();
  const row = rateMap.get(key);
  if (!row || now > row.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + rateWindowMs });
    return true;
  }
  if (row.count >= rateMax) return false;
  row.count += 1;
  return true;
}

export function drainSlackRetryQueue(): void {
  const batch = slackRetryQueue.splice(0, 10);
  for (const fn of batch) {
    void fn().catch(() => undefined);
  }
}

async function postToOrgChannel(
  organizationId: number,
  text: string,
  blocks?: KnownBlock[],
): Promise<void> {
  const integ = await getSlackIntegrationByOrganizationId(organizationId);
  if (!integ?.isActive || !integ.channelId) return;
  const token = decryptSlackToken(integ.accessToken);
  const client = createSlackClient(token);
  try {
    await client.postMessage(integ.channelId, text, blocks);
  } catch {
    slackRetryQueue.push(async () => {
      await client.postMessage(integ.channelId!, text, blocks);
    });
  }
}

async function findSlackUserForUser(userId: number): Promise<string | null> {
  const { db } = await import("@/db/index");
  const { accounts } = await import("@/db/schema");
  const { and, eq } = await import("drizzle-orm");
  const row = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.provider, "slack")),
  });
  return row?.providerAccountId ?? null;
}

export class SlackNotificationService {
  async notifyTrainingStarted(sessionId: number): Promise<void> {
    const session = await getSessionById(sessionId);
    if (!session?.user || !session.scenario || session.organizationId === null) return;
    const user = await getUserById(session.userId);
    if (user && !user.slackNotificationsEnabled) return;
    const integ = await getSlackIntegrationByOrganizationId(session.organizationId);
    if (!integ?.isActive || !integ.channelId) return;
    const s = readSettings(integ.notificationSettings);
    if (s.trainingStarted === false) return;
    if (!rateAllowed(session.userId)) return;
    const blocks = trainingStartBlock(
      session.scenario.name,
      session.scenario.difficulty,
      session.user.name,
      session.scenario.estimatedDuration,
      sessionId,
    );
    await postToOrgChannel(session.organizationId, "Training started", blocks);
  }

  async notifyFlagFound(sessionId: number, flagNumber: number): Promise<void> {
    const session = await getSessionById(sessionId);
    if (!session?.user || !session.scenario || session.organizationId === null) return;
    const user = await getUserById(session.userId);
    if (user && !user.slackNotificationsEnabled) return;
    const integ = await getSlackIntegrationByOrganizationId(session.organizationId);
    if (!integ?.isActive || !integ.channelId) return;
    const s = readSettings(integ.notificationSettings);
    if (s.flagFound === false) return;
    if (!rateAllowed(session.userId)) return;
    const total = session.events.filter((e) => e.eventType === "flag_correct").length;
    const blocks = flagFoundBlock(
      session.scenario.name,
      flagNumber,
      Math.max(total, flagNumber),
      session.finalScore,
    );
    await postToOrgChannel(session.organizationId, "Flag found", blocks);
  }

  async notifySessionCompleted(sessionId: number): Promise<void> {
    const session = await getSessionById(sessionId);
    if (!session?.user || !session.scenario || session.organizationId === null) return;
    const user = await getUserById(session.userId);
    if (user && !user.slackNotificationsEnabled) return;
    const integ = await getSlackIntegrationByOrganizationId(session.organizationId);
    if (!integ?.isActive || !integ.channelId) return;
    const s = readSettings(integ.notificationSettings);
    if (s.sessionCompleted === false) return;
    const hints = session.events.filter((e) => e.eventType === "hint_given").length;
    const completed = session.events.find((e) => e.eventType === "session_completed");
    const payload = (completed?.payload ?? {}) as { grade?: string };
    const grade = payload.grade ?? "—";
    const score = session.finalScore ?? 0;
    const timeSpentSec = session.timeSpent ?? 0;
    const timeSpent = `${Math.round(timeSpentSec / 60)}m`;
    const blocks = sessionCompleteBlock({
      userName: session.user.name,
      scenarioName: session.scenario.name,
      score,
      grade,
      timeSpent,
      hintsUsed: hints,
      sessionId,
    });
    await postToOrgChannel(session.organizationId, "Session complete", blocks);
  }

  async notifyWeeklyDigest(orgId: number): Promise<void> {
    const integ = await getSlackIntegrationByOrganizationId(orgId);
    if (!integ?.isActive || !integ.channelId) return;
    const s = readSettings(integ.notificationSettings);
    if (s.weeklyDigest === false) return;
    const analytics = await getOrganizationAnalytics(orgId);
    const top = analytics.topPerformers[0];
    const blocks = weeklyDigestBlock({
      sessionsCompleted: analytics.totalSessions,
      avgTeamScore: analytics.averageScore,
      topPerformer: top?.name ?? null,
      upcomingHint: "Schedule team blocks in SentinelForge.",
    });
    await postToOrgChannel(orgId, "Weekly digest", blocks);
  }

  async sendDirectMessage(userId: number, message: string, blocks?: KnownBlock[]): Promise<void> {
    const user = await getUserById(userId);
    if (!user?.organizationId) return;
    const integ = await getSlackIntegrationByOrganizationId(user.organizationId);
    if (!integ?.isActive) return;
    const slackUid = await findSlackUserForUser(userId);
    if (!slackUid) return;
    const token = decryptSlackToken(integ.accessToken);
    const client = createSlackClient(token);
    await client.sendDM(slackUid, message, blocks);
  }

  async postLeaderboard(orgId: number): Promise<void> {
    const integ = await getSlackIntegrationByOrganizationId(orgId);
    if (!integ?.isActive || !integ.channelId) return;
    const org = await getOrganizationById(orgId);
    const team = await getTeamProgress(orgId);
    const sorted = [...team].sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0)).slice(0, 8);
    const rows: LeaderboardRow[] = sorted.map((u, i) => ({
      rank: i + 1,
      name: u.name,
      sessions: u.sessionsCompleted,
      avgScore: u.averageScore,
    }));
    const blocks = teamLeaderboardBlock(org?.name ?? "Team", rows);
    await postToOrgChannel(orgId, "Leaderboard", blocks);
  }

  async postIncidentSimulation(orgId: number, scenarioId: number): Promise<void> {
    const integ = await getSlackIntegrationByOrganizationId(orgId);
    if (!integ?.isActive || !integ.channelId) return;
    const s = readSettings(integ.notificationSettings);
    if (s.incidentSimulations === false) return;
    const { getScenarioById } = await import("@/db/queries");
    const scenario = await getScenarioById(scenarioId);
    if (!scenario) return;
    const blocks = incidentSimulationBlock(scenario.name, scenario.description, scenario.id);
    await postToOrgChannel(orgId, "Incident simulation", blocks);
  }
}

export const slackNotificationService = new SlackNotificationService();
