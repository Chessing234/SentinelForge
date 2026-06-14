import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getOrganizationById, updateOrganization } from "@/db/queries";

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  seatLimit: z.number().int().min(1).max(100_000).optional(),
  plan: z.enum(["free", "academic", "enterprise"]).optional(),
});

function orgIdFromSession(session: { user: { organizationId?: unknown } }): number | null {
  const v = session.user.organizationId;
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function canEditOrg(role: string | undefined): boolean {
  return role === "enterprise_admin" || role === "admin";
}

export async function GET(): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orgId = orgIdFromSession(session);
  if (!orgId) {
    return NextResponse.json({ error: "Organization required" }, { status: 400 });
  }
  const org = await getOrganizationById(orgId);
  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ organization: org });
}

export async function PATCH(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canEditOrg(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const orgId = orgIdFromSession(session);
  if (!orgId) {
    return NextResponse.json({ error: "Organization required" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const row = await updateOrganization(orgId, parsed.data);
  if (!row) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
  return NextResponse.json({ organization: row });
}
