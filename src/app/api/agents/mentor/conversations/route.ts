import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getConversationBySession, getTrainingSessionForUser } from "@/db/queries";

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

  const rows = await getConversationBySession(sessionId);
  return NextResponse.json({
    messages: rows.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      metadata: m.metadata,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
