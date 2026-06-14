import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getTrainingSessionForUser } from "@/db/queries";
import { environmentAgent } from "@/lib/agents/environment";

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const sessionId = Number(url.searchParams.get("sessionId"));
  if (!Number.isFinite(sessionId)) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  const userId = Number(session.user.id);
  const owned = await getTrainingSessionForUser(sessionId, userId);
  if (!owned) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const topology = await environmentAgent.getState(sessionId);
  if (!topology) {
    return NextResponse.json(
      { error: "Environment not loaded (restart session or re-initialize)." },
      { status: 404 },
    );
  }

  return NextResponse.json({ topology });
}
