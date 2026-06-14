import {
  findUserIdBySlackAccount,
  getSessionById,
  getSlackIntegrationByTeamId,
  getUserById,
} from "@/db/queries";
import { startEnvironmentTrainingSession } from "@/lib/agents/environment/start-session";
import { dashboardUrl } from "@/lib/slack/blocks";
import { createSlackClient } from "@/lib/slack/client";
import { decryptSlackToken } from "@/lib/slack/token-crypto";

type SlackInteraction = {
  type?: string;
  user?: { id?: string };
  team?: { id?: string };
  channel?: { id?: string };
  response_url?: string;
  actions?: Array<{ action_id?: string; value?: string }>;
};

export async function processSlackInteraction(payload: SlackInteraction): Promise<void> {
  if (payload.type !== "block_actions") return;
  const teamId = payload.team?.id ?? "";
  if (!teamId) return;
  const integ = await getSlackIntegrationByTeamId(teamId);
  if (!integ?.isActive) return;
  const slackUserId = payload.user?.id;
  if (!slackUserId) return;
  const action = payload.actions?.[0];
  if (!action?.action_id) return;

  const token = decryptSlackToken(integ.accessToken);
  const client = createSlackClient(token);

  const sessionId = Number(action.value);
  const scenarioId = Number(action.value);

  if (action.action_id === "view_progress" || action.action_id === "view_report") {
    if (!Number.isFinite(sessionId) || sessionId <= 0) return;
    const path =
      action.action_id === "view_progress"
        ? `/dashboard/training/${sessionId}`
        : `/dashboard/training/${sessionId}`;
    const msg =
      action.action_id === "view_progress"
        ? `Open your live session: ${dashboardUrl(path)}`
        : `Session report: ${dashboardUrl(path)}`;
    await client.sendDM(slackUserId, msg);
    return;
  }

  if (action.action_id === "share_results") {
    if (!Number.isFinite(sessionId) || sessionId <= 0 || !payload.channel?.id) return;
    const session = await getSessionById(sessionId);
    if (!session?.user || session.organizationId !== integ.organizationId) return;
    const score = session.finalScore ?? "—";
    await client.postMessage(
      payload.channel.id,
      `<@${slackUserId}> shared results for session #${sessionId}: *${session.user.name}* — score *${score}* on *${session.scenario?.name ?? "scenario"}*.`,
    );
    return;
  }

  if (action.action_id === "join_exercise") {
    if (!Number.isFinite(scenarioId) || scenarioId <= 0) return;
    const userId = await findUserIdBySlackAccount(slackUserId);
    if (!userId) {
      await client.sendDM(
        slackUserId,
        "Link your SentinelForge account to Slack from the dashboard before joining an exercise.",
      );
      return;
    }
    const user = await getUserById(userId);
    if (!user?.organizationId || user.organizationId !== integ.organizationId) {
      await client.sendDM(slackUserId, "Your account is not in this organization's SentinelForge workspace.");
      return;
    }
    const started = await startEnvironmentTrainingSession({
      userId,
      organizationId: user.organizationId,
      scenarioId,
    });
    if (!started.ok) {
      await client.sendDM(slackUserId, `Could not start training: ${started.error}`);
      return;
    }
    const { slackNotificationService } = await import("@/lib/slack/notifications");
    void slackNotificationService.notifyTrainingStarted(started.sessionId).catch(() => undefined);
    await client.sendDM(
      slackUserId,
      `Exercise started — session #${started.sessionId}. Open: ${dashboardUrl(`/dashboard/training/${started.sessionId}`)}`,
    );
  }
}
