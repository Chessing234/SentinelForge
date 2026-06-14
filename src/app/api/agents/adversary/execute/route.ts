import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { adversaryAgent } from "@/lib/agents/adversary";

const bodySchema = z.object({
  sessionId: z.number().int().positive(),
  all: z.boolean().optional(),
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
    if (parsed.data.all) {
      const chain = await adversaryAgent.executeAll(parsed.data.sessionId, userId);
      return NextResponse.json({ chain, mode: "all" });
    }
    const step = await adversaryAgent.executeNextStep(parsed.data.sessionId, userId);
    return NextResponse.json({ step, mode: "next" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Execute failed" },
      { status: 400 },
    );
  }
}
