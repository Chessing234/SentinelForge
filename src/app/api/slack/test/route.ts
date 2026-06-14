import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getSlackIntegrationByOrganizationId } from "@/db/queries";
import { createSlackClient } from "@/lib/slack/client";
import { decryptSlackToken } from "@/lib/slack/token-crypto";

function orgIdFromSession(session: { user: { organizationId?: unknown } }): number | null {
  const v = session.user.organizationId;
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function canManageSlack(role: string | undefined): boolean {
  return role === "enterprise_admin" || role === "admin";
}

export async function POST(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageSlack(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orgId = orgIdFromSession(session);
  if (!orgId) {
    return NextResponse.json({ error: "Organization required" }, { status: 400 });
  }
  const integ = await getSlackIntegrationByOrganizationId(orgId);
  if (!integ?.isActive || !integ.channelId) {
    return NextResponse.json(
      { error: "Slack not connected or default channel not set" },
      { status: 400 },
    );
  }
  const token = decryptSlackToken(integ.accessToken);
  const client = createSlackClient(token);
  try {
    await client.postMessage(integ.channelId, "SentinelForge test notification — your Slack integration is working.");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "post_failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
