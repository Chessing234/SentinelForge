import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getTrainingSessionForUser } from "@/db/queries";
import { evaluatorAgent } from "@/lib/agents/evaluator";

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

  try {
    const breakdown = await evaluatorAgent.evaluateSession(parsed.data.sessionId, userId);
    return NextResponse.json({ breakdown });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Evaluation failed" },
      { status: 400 },
    );
  }
}
