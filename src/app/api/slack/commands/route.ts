import { NextResponse } from "next/server";

import { buildSentinelForgeSlashBlocks } from "@/lib/slack/commands-handler";
import { verifySlackSignature } from "@/lib/slack/verify-request";

export async function POST(request: Request): Promise<Response> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    return NextResponse.json({ error: "Slack signing secret not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const ok = verifySlackSignature({
    signingSecret,
    rawBody,
    timestamp: request.headers.get("x-slack-request-timestamp"),
    signature: request.headers.get("x-slack-signature"),
  });
  if (!ok) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const command = (params.get("command") ?? "").trim();
  const text = (params.get("text") ?? "").trim();
  const teamId = params.get("team_id") ?? "";
  const userId = params.get("user_id") ?? "";

  if (command !== "/sentinelforge") {
    return NextResponse.json({
      response_type: "ephemeral",
      text: "Unknown command.",
    });
  }

  const blocks = await buildSentinelForgeSlashBlocks({
    teamId,
    slackUserId: userId,
    commandText: text,
  });

  return NextResponse.json({
    response_type: "ephemeral",
    blocks,
  });
}
