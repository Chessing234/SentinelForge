import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { buildContext } from "@/lib/agents/mentor/context-builder";
import { getHintLevelsUsed, getMentorHintStepKey, hintAlreadyUsed } from "@/lib/agents/mentor/hint-system";
import { mentorAgent } from "@/lib/agents/mentor";

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const sessionId = Number(url.searchParams.get("sessionId"));
  const levelRaw = url.searchParams.get("level");
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const userId = Number(session.user.id);
  const ctx = await buildContext(sessionId, userId);
  if (!ctx) {
    return NextResponse.json({ error: "Forbidden or session not found" }, { status: 403 });
  }

  const stepKey = getMentorHintStepKey(ctx);
  const usedLevels = getHintLevelsUsed(sessionId, stepKey);

  if (levelRaw === null || levelRaw === "") {
    return NextResponse.json({ stepKey, usedLevels });
  }

  const level = Number(levelRaw) as 1 | 2 | 3;
  if (![1, 2, 3].includes(level)) {
    return NextResponse.json({ error: "level must be 1, 2, or 3" }, { status: 400 });
  }

  if (hintAlreadyUsed(sessionId, stepKey, level)) {
    return NextResponse.json(
      { error: "Hint level already used for this step", usedLevels, stepKey },
      { status: 409 },
    );
  }

  try {
    const hint = await mentorAgent.getHint(sessionId, userId, level);
    return NextResponse.json({
      hint,
      usedLevels: getHintLevelsUsed(sessionId, stepKey),
      stepKey,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Hint failed" },
      { status: 400 },
    );
  }
}
