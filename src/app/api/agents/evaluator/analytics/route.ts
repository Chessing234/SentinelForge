import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { orgAnalyticsToCsv } from "@/lib/agents/evaluator/analytics";
import { evaluatorAgent } from "@/lib/agents/evaluator";

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role ?? "student";
  if (!["admin", "enterprise_admin", "instructor"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const orgParam = url.searchParams.get("organizationId");
  const format = url.searchParams.get("format");
  const selfOrg = session.user.organizationId;

  let orgId: number | null = null;
  if (role === "admin" && orgParam) {
    orgId = Number(orgParam);
  } else if (selfOrg !== null && selfOrg !== undefined) {
    orgId = Number(selfOrg);
  }

  if (!Number.isFinite(orgId) || orgId === null) {
    return NextResponse.json({ error: "organizationId required" }, { status: 400 });
  }

  if (role !== "admin" && orgParam && Number(orgParam) !== orgId) {
    return NextResponse.json({ error: "Cannot view another organization" }, { status: 403 });
  }

  const data = await evaluatorAgent.getOrganizationAnalytics(orgId);
  const team = await evaluatorAgent.getTeamProgress(orgId);

  if (format === "csv") {
    const csv = orgAnalyticsToCsv(data);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="org-${orgId}-analytics.csv"`,
      },
    });
  }

  return NextResponse.json({ analytics: data, team });
}
