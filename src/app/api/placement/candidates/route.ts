import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getJobById } from "@/db/queries";
import { placementAgent } from "@/lib/agents/placement";

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role ?? "student";
  if (role !== "enterprise_admin" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const jobId = Number(url.searchParams.get("jobId"));
  const minScore = url.searchParams.get("minScore");
  if (!Number.isFinite(jobId)) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  const job = await getJobById(jobId);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const sessionOrg =
    session.user.organizationId === null || session.user.organizationId === undefined
      ? null
      : Number(session.user.organizationId);

  if (role !== "admin") {
    if (sessionOrg === null || job.organizationId !== sessionOrg) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const min = minScore === null || minScore === "" ? undefined : Number(minScore);
  if (min !== undefined && !Number.isFinite(min)) {
    return NextResponse.json({ error: "Invalid minScore" }, { status: 400 });
  }

  try {
    const candidates = await placementAgent.findCandidates(jobId, min);
    return NextResponse.json({ candidates });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Lookup failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
