import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
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

  try {
    const breakdown = await evaluatorAgent.evaluateSession(parsed.data.sessionId, userId);
    return NextResponse.json({ breakdown });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Finish failed";
    const status = msg.includes("denied") || msg.includes("not found") ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
