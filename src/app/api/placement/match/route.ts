import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getJobById } from "@/db/queries";
import { placementAgent } from "@/lib/agents/placement";

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const userId = Number(url.searchParams.get("userId"));
  const jobId = Number(url.searchParams.get("jobId"));
  if (!Number.isFinite(userId) || !Number.isFinite(jobId)) {
    return NextResponse.json({ error: "userId and jobId required" }, { status: 400 });
  }

  const selfId = Number(session.user.id);
  const role = session.user.role ?? "student";
  if (userId === selfId || role === "admin") {
    try {
      const match = await placementAgent.calculateMatch(userId, jobId);
      return NextResponse.json({ match });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Match failed";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  if (role !== "enterprise_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sessionOrg =
    session.user.organizationId === null || session.user.organizationId === undefined
      ? null
      : Number(session.user.organizationId);
  if (sessionOrg === null) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const job = await getJobById(jobId);
  if (!job || job.organizationId !== sessionOrg) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const match = await placementAgent.calculateMatch(userId, jobId);
    return NextResponse.json({ match });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Match failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
