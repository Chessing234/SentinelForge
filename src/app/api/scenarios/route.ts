import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { createScenario } from "@/db/queries";

const bodySchema = z.object({
  name: z.string().min(3).max(255),
  description: z.string().min(10),
  difficulty: z.enum(["beginner", "intermediate", "advanced", "expert"]),
  category: z.enum([
    "network_security",
    "web_security",
    "cloud_security",
    "incident_response",
    "malware_analysis",
    "forensics",
  ]),
  mitreTechniques: z.string().min(1),
  estimatedDuration: z.number().int().min(5).max(240),
});

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
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
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const scenario = await createScenario({
    name: parsed.data.name.trim(),
    description: parsed.data.description.trim(),
    difficulty: parsed.data.difficulty,
    category: parsed.data.category,
    mitreTechniques: parsed.data.mitreTechniques.trim(),
    estimatedDuration: parsed.data.estimatedDuration,
    isActive: true,
    createdBy: Number(session.user.id),
  });

  if (!scenario) {
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }

  return NextResponse.json({ scenario }, { status: 201 });
}
