import type { KnownBlock } from "@slack/web-api";

import {
  findUserIdBySlackAccount,
  getActiveScenarios,
  getOrganizationById,
  getSlackIntegrationByTeamId,
  getUserById,
  getUserSessions,
} from "@/db/queries";
import { startEnvironmentTrainingSession } from "@/lib/agents/environment/start-session";
import { getTeamProgress } from "@/lib/agents/evaluator/analytics";
import { teamLeaderboardBlock } from "@/lib/slack/blocks";

function section(text: string): KnownBlock {
  return { type: "section", text: { type: "mrkdwn", text } };
}

function helpBlocks(): KnownBlock[] {
  return [
    {
      type: "header",
      text: { type: "plain_text", text: "SentinelForge commands", emoji: true },
    },
    section(
      [
        "• `/sentinelforge help` — this message",
        "• `/sentinelforge training` — your current training status",
        "• `/sentinelforge start <scenario-id>` — start a scenario",
        "• `/sentinelforge score` — recent scores",
        "• `/sentinelforge leaderboard` — team leaderboard",
        "• `/sentinelforge scenarios` — list scenarios",
      ].join("\n"),
    ),
  ];
}

export async function buildSentinelForgeSlashBlocks(params: {
  teamId: string;
  slackUserId: string;
  commandText: string;
}): Promise<KnownBlock[]> {
  const integ = await getSlackIntegrationByTeamId(params.teamId);
  if (!integ?.isActive) {
    return [section("SentinelForge is not connected for this Slack workspace.")];
  }

  const parts = params.commandText.split(/\s+/).filter(Boolean);
  const sub = (parts[0]?.toLowerCase() ?? "help") as string;

  if (sub === "help") {
    return helpBlocks();
  }

  if (sub === "scenarios") {
    const list = await getActiveScenarios();
    const lines = list.slice(0, 20).map((s) => `• \`${s.id}\` — *${s.name}* (${s.difficulty})`);
    return [
      { type: "header", text: { type: "plain_text", text: "Available scenarios", emoji: true } },
      section(lines.join("\n") || "_No active scenarios._"),
    ];
  }

  const userId = await findUserIdBySlackAccount(params.slackUserId);
  const user = userId ? await getUserById(userId) : null;
  if (!userId || !user) {
    return [
      section(
        "Your Slack account is not linked to SentinelForge yet. Sign in with Slack from the dashboard or contact your admin.",
      ),
    ];
  }
  if (!user.organizationId || user.organizationId !== integ.organizationId) {
    return [section("Your SentinelForge account is not in this workspace's organization.")];
  }

  if (sub === "training") {
    const sessions = await getUserSessions(userId);
    const running = sessions.find((s) => s.status === "running" || s.status === "pending");
    if (!running) {
      return [section("You have no active training session. Use `/sentinelforge scenarios` then `/sentinelforge start <id>`.")];
    }
    return [
      section(
        `*Session #${running.id}* — status: *${running.status}*\nScenario id: \`${running.scenarioId}\``,
      ),
    ];
  }

  if (sub === "score") {
    const sessions = await getUserSessions(userId);
    const recent = sessions.filter((s) => s.status === "completed" && s.finalScore != null).slice(0, 5);
    if (recent.length === 0) {
      return [section("No completed sessions yet.")];
    }
    const lines = recent.map(
      (s) => `• Session #${s.id} — score *${s.finalScore ?? "—"}* (${s.status})`,
    );
    return [
      { type: "header", text: { type: "plain_text", text: "Recent scores", emoji: true } },
      section(lines.join("\n")),
    ];
  }

  if (sub === "leaderboard") {
    const org = await getOrganizationById(integ.organizationId);
    const team = await getTeamProgress(integ.organizationId);
    const sorted = [...team].sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0)).slice(0, 8);
    const rows = sorted.map((u, i) => ({
      rank: i + 1,
      name: u.name,
      sessions: u.sessionsCompleted,
      avgScore: u.averageScore,
    }));
    return teamLeaderboardBlock(org?.name ?? "Team", rows);
  }

  if (sub === "start") {
    const scenarioId = Number(parts[1]);
    if (!Number.isFinite(scenarioId) || scenarioId <= 0) {
      return [section("Usage: `/sentinelforge start <scenario-id>` (see `/sentinelforge scenarios`).")];
    }
    const started = await startEnvironmentTrainingSession({
      userId,
      organizationId: user.organizationId,
      scenarioId,
    });
    if (!started.ok) {
      return [section(`Could not start: _${started.error}_`)];
    }
    const { slackNotificationService } = await import("@/lib/slack/notifications");
    void slackNotificationService.notifyTrainingStarted(started.sessionId).catch(() => undefined);
    return [
      section(
        `Started training session *#${started.sessionId}*. Open SentinelForge training in your browser to continue.`,
      ),
    ];
  }

  return helpBlocks();
}
