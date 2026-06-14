import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { setScenarioActive } from "@/db/queries";

const bodySchema = z.object({
  id: z.number().int().positive(),
  isActive: z.boolean(),
});

export async function PATCH(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const row = await setScenarioActive(parsed.data.id, parsed.data.isActive);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ scenario: row });
}
