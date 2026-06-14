import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { startEnvironmentTrainingSession } from "@/lib/agents/environment/start-session";
import { slackNotificationService } from "@/lib/slack/notifications";

const bodySchema = z.object({
  scenarioId: z.number().int().positive(),
});

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userId = Number(session.user.id);
  const orgId =
    session.user.organizationId === null || session.user.organizationId === undefined
      ? null
      : Number(session.user.organizationId);

  const started = await startEnvironmentTrainingSession({
    userId,
    organizationId: orgId,
    scenarioId: parsed.data.scenarioId,
  });

  if (!started.ok) {
    return NextResponse.json({ error: started.error }, { status: 400 });
  }

  void slackNotificationService.notifyTrainingStarted(started.sessionId).catch(() => undefined);

  return NextResponse.json({
    sessionId: started.sessionId,
    overview: started.overview,
  });
}
