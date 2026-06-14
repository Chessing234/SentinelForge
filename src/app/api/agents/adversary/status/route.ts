import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { adversaryAgent } from "@/lib/agents/adversary";

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
  const chain = await adversaryAgent.getStatus(sessionId, userId);
  if (!chain) {
    return NextResponse.json({ error: "No attack chain for this session" }, { status: 404 });
  }

  return NextResponse.json({ chain });
}
