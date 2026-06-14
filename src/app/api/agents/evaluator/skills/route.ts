import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { evaluatorAgent } from "@/lib/agents/evaluator";

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const requested = url.searchParams.get("userId");
  const selfId = Number(session.user.id);
  const targetId = requested ? Number(requested) : selfId;
  if (!Number.isFinite(targetId)) {
    return NextResponse.json({ error: "Invalid userId" }, { status: 400 });
  }

  const role = session.user.role ?? "student";
  if (targetId !== selfId && !["admin", "enterprise_admin", "instructor"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const matrix = await evaluatorAgent.getSkillMatrix(targetId);
  const gaps = await evaluatorAgent.getSkillGaps(targetId);
  const recommendations = await evaluatorAgent.getRecommendations(targetId);

  return NextResponse.json({ matrix, gaps, recommendations });
}
