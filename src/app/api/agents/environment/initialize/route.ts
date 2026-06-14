import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { startEnvironmentTrainingSession } from "@/lib/agents/environment/start-session";

const bodySchema = z.object({
  scenarioId: z.number().int().positive(),
});

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const userId = Number(session.user.id);
  const orgId =
    session.user.organizationId === null || session.user.organizationId === undefined
      ? null
      : Number(session.user.organizationId);

  try {
    const started = await startEnvironmentTrainingSession({
      userId,
      organizationId: orgId,
      scenarioId: parsed.data.scenarioId,
    });

    if (!started.ok) {
      if (started.error === "scenario_not_found") {
        return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
      }
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    return NextResponse.json(
      { sessionId: started.sessionId, overview: started.overview },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Initialize failed" },
      { status: 500 },
    );
  }
}
