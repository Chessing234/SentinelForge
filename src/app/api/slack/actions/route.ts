import { NextResponse } from "next/server";

import { processSlackInteraction } from "@/lib/slack/interactions-handler";
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
  const payloadStr = params.get("payload");
  if (!payloadStr) {
    return NextResponse.json({ error: "Missing payload" }, { status: 400 });
  }

  let payload: Parameters<typeof processSlackInteraction>[0];
  try {
    payload = JSON.parse(payloadStr) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid payload JSON" }, { status: 400 });
  }

  void processSlackInteraction(payload).catch((e) => console.error("[slack actions]", e));

  return NextResponse.json({ ok: true });
}
