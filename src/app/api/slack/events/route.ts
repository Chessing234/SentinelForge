import { NextResponse } from "next/server";

import { processSlackEventEnvelope, type SlackEventEnvelope } from "@/lib/slack/events-handler";
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

  let body: { type?: string; challenge?: string; team_id?: string; event?: Record<string, unknown> };
  try {
    body = JSON.parse(rawBody) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.type === "url_verification" && typeof body.challenge === "string") {
    return new NextResponse(body.challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (body.type === "event_callback") {
    void processSlackEventEnvelope(body as SlackEventEnvelope).catch((e) => console.error("[slack events]", e));
  }

  return NextResponse.json({ ok: true });
}
