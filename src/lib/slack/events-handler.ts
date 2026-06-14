import { getSlackIntegrationByTeamId } from "@/db/queries";
import { createSlackClient } from "@/lib/slack/client";
import { decryptSlackToken } from "@/lib/slack/token-crypto";

export type SlackEventEnvelope = {
  team_id?: string;
  event?: {
    type?: string;
    channel?: string;
    user?: string;
    text?: string;
    bot_id?: string;
    subtype?: string;
  };
};

export async function processSlackEventEnvelope(body: SlackEventEnvelope): Promise<void> {
  const ev = body.event;
  if (!ev?.type) return;
  const teamId = body.team_id ?? "";
  if (!teamId) return;
  const integ = await getSlackIntegrationByTeamId(teamId);
  if (!integ?.isActive) return;
  const token = decryptSlackToken(integ.accessToken);
  const client = createSlackClient(token);

  if (ev.type === "app_mention" && ev.channel) {
    await client.postMessage(
      ev.channel,
      "Hi! I am the SentinelForge training bot. Use `/sentinelforge help` for commands.",
    );
    return;
  }

  if (ev.type === "member_joined_channel" && ev.channel && ev.user && !ev.bot_id) {
    await client.postMessage(
      ev.channel,
      `Welcome to SentinelForge training, <@${ev.user}>! Use \`/sentinelforge help\` to get started.`,
    );
    return;
  }

  if (ev.type === "reaction_added") {
    // Engagement hook — extend with analytics if needed.
    return;
  }
}
