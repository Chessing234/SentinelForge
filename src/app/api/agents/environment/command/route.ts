import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { createSessionEvent, getTrainingSessionForUser } from "@/db/queries";
import { environmentAgent } from "@/lib/agents/environment";
import { loadState, saveState } from "@/lib/agents/environment/session-store";

const bodySchema = z.object({
  sessionId: z.number().int().positive(),
  command: z.string().min(1).max(8000),
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
  const owned = await getTrainingSessionForUser(parsed.data.sessionId, userId);
  if (!owned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const trimmed = parsed.data.command.trim();
  const isFlagCmd = /^(flag|submit)\s+/i.test(trimmed);

  const result = await environmentAgent.executeCommand(
    parsed.data.sessionId,
    parsed.data.command,
  );

  const payload = loadState(parsed.data.sessionId);
  if (payload) {
    saveState(parsed.data.sessionId, payload);
  }

  if (!isFlagCmd) {
    await createSessionEvent({
      sessionId: parsed.data.sessionId,
      eventType: "milestone_reached",
      payload: {
        command: parsed.data.command,
        exitCode: result.exitCode,
        stdoutPreview: result.stdout.slice(0, 2000),
      },
    });
  }

  return NextResponse.json({ result });
}
