import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { mentorAgent } from "@/lib/agents/mentor";

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
  try {
    const response = await mentorAgent.chat(
      parsed.data.sessionId,
      userId,
      parsed.data.message,
    );
    return NextResponse.json(response);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chat failed";
    let status = msg.includes("denied") || msg.includes("not found") ? 403 : 400;
    if (msg.includes("Message limit")) status = 429;
    return NextResponse.json({ error: msg }, { status });
  }
}
