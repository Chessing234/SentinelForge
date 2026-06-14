import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { createSessionEvent, getTrainingSessionForUser, updateSession } from "@/db/queries";

const bodySchema = z.object({
  sessionId: z.number().int().positive(),
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

  await updateSession(parsed.data.sessionId, {
    status: "abandoned",
    completedAt: new Date(),
  });

  await createSessionEvent({
    sessionId: parsed.data.sessionId,
    eventType: "milestone_reached",
    payload: { kind: "session_aborted" },
  });

  return NextResponse.json({ ok: true });
}
