import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  deleteSlackIntegration,
  getSlackIntegrationByOrganizationId,
  updateSlackIntegrationForOrg,
} from "@/db/queries";

const patchSchema = z.object({
  channelId: z.string().max(255).optional().nullable(),
  notificationSettings: z
    .object({
      trainingStarted: z.boolean().optional(),
      flagFound: z.boolean().optional(),
      sessionCompleted: z.boolean().optional(),
      weeklyDigest: z.boolean().optional(),
      incidentSimulations: z.boolean().optional(),
    })
    .optional(),
});

function orgIdFromSession(session: { user: { organizationId?: unknown } }): number | null {
  const v = session.user.organizationId;
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function canManageSlack(role: string | undefined): boolean {
  return role === "enterprise_admin" || role === "admin";
}

export async function GET(): Promise<Response> {
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
  const row = await getSlackIntegrationByOrganizationId(orgId);
  if (!row) {
    return NextResponse.json({
      connected: false,
      slackTeamName: null,
      channelId: null,
      notificationSettings: null,
    });
  }
  return NextResponse.json({
    connected: row.isActive,
    slackTeamName: row.slackTeamName,
    slackTeamId: row.slackTeamId,
    channelId: row.channelId,
    notificationSettings: row.notificationSettings,
  });
}

export async function PATCH(request: Request): Promise<Response> {
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const existing = await getSlackIntegrationByOrganizationId(orgId);
  if (!existing) {
    return NextResponse.json({ error: "Slack not connected" }, { status: 400 });
  }

  const d = parsed.data;
  const nextSettings =
    d.notificationSettings !== undefined
      ? {
          ...(typeof existing.notificationSettings === "object" && existing.notificationSettings !== null
            ? (existing.notificationSettings as Record<string, boolean>)
            : {}),
          ...d.notificationSettings,
        }
      : undefined;

  const channelId =
    d.channelId === undefined ? undefined : d.channelId === "" || d.channelId === null ? null : d.channelId;

  const row = await updateSlackIntegrationForOrg(orgId, {
    ...(channelId !== undefined ? { channelId } : {}),
    ...(nextSettings !== undefined ? { notificationSettings: nextSettings } : {}),
  });

  return NextResponse.json({
    connected: row?.isActive ?? true,
    slackTeamName: row?.slackTeamName ?? existing.slackTeamName,
    channelId: row?.channelId ?? null,
    notificationSettings: row?.notificationSettings ?? existing.notificationSettings,
  });
}

export async function DELETE(): Promise<Response> {
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
  await deleteSlackIntegration(orgId);
  return NextResponse.json({ ok: true });
}
