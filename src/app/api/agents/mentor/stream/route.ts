import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getTrainingSessionForUser } from "@/db/queries";
import { mentorAgent } from "@/lib/agents/mentor";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  sessionId: z.number().int().positive(),
  message: z.string().min(1).max(8000),
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

  const stream = mentorAgent.createMentorChatStream(
    parsed.data.sessionId,
    userId,
    parsed.data.message,
  );

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
