import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getApplicationById, updateApplication } from "@/db/queries";
import { placementAgent } from "@/lib/agents/placement";

const withdrawSchema = z.object({
  status: z.literal("withdrawn"),
});

const hrStatusSchema = z.object({
  status: z.enum(["reviewing", "interview", "offered", "rejected", "accepted", "applied"]),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ applicationId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appId = Number((await ctx.params).applicationId);
  if (!Number.isFinite(appId)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const row = await getApplicationById(appId);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const withdraw = withdrawSchema.safeParse(json);
  if (withdraw.success) {
    if (row.userId !== Number(session.user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const updated = await updateApplication(appId, { status: "withdrawn" });
    return NextResponse.json({ application: updated });
  }

  const hr = hrStatusSchema.safeParse(json);
  if (!hr.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const role = session.user.role ?? "student";
  if (role !== "enterprise_admin" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orgId =
    session.user.organizationId === null || session.user.organizationId === undefined
      ? null
      : Number(session.user.organizationId);

  try {
    await placementAgent.updateApplicationStatus(appId, hr.data.status, orgId, {
      admin: role === "admin",
    });
    const updated = await getApplicationById(appId);
    return NextResponse.json({ application: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return NextResponse.json({ error: msg }, { status: role === "admin" ? 400 : 403 });
  }
}
