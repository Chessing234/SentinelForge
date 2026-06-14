import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { placementAgent } from "@/lib/agents/placement";

const bodySchema = z.object({
  userId: z.number().int().positive().optional(),
});

export async function POST(
  request: Request,
  ctx: { params: Promise<{ jobId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobId = Number((await ctx.params).jobId);
  if (!Number.isFinite(jobId)) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  let json: unknown = {};
  try {
    json = await request.json();
  } catch {
    json = {};
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const userId = parsed.data.userId ?? Number(session.user.id);
  if (userId !== Number(session.user.id) && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const application = await placementAgent.apply(userId, jobId);
    const match = await placementAgent.calculateMatch(userId, jobId);
    return NextResponse.json({ application, match });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Apply failed";
    const status = msg.includes("Already") ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
