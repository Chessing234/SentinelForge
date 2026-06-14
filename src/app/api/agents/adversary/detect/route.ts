import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { adversaryAgent } from "@/lib/agents/adversary";

const bodySchema = z.object({
  sessionId: z.number().int().positive(),
  detection: z.string().min(1).max(2000),
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
  const out = await adversaryAgent.validateDetection(
    parsed.data.sessionId,
    userId,
    parsed.data.detection,
  );
  if (!out) {
    return NextResponse.json({ error: "No attack chain" }, { status: 404 });
  }

  return NextResponse.json({ correct: out.correct, score: out.score });
}
