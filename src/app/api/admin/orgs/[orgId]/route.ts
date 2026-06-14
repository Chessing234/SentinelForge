import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { updateOrganization } from "@/db/queries";

const patchSchema = z.object({
  suspended: z.boolean().optional(),
  name: z.string().min(1).max(255).optional(),
});

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ orgId: string }> },
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { orgId: raw } = await ctx.params;
  const orgId = Number(raw);
  if (!Number.isFinite(orgId)) {
    return NextResponse.json({ error: "Invalid org id" }, { status: 400 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const row = await updateOrganization(orgId, parsed.data);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ organization: row });
}
