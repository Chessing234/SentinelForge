import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { getJobById, updateJob } from "@/db/queries";

const patchSchema = z.object({
  title: z.string().min(2).max(255).optional(),
  description: z.string().min(10).optional(),
  location: z.string().max(255).optional().nullable(),
  salaryRange: z.string().max(100).optional().nullable(),
  jobType: z.string().max(64).optional().nullable(),
  experienceLevel: z.string().max(64).optional().nullable(),
  requiredSkills: z
    .array(
      z.object({
        key: z.string().min(1),
        label: z.string().min(1),
        minScore: z.number().min(0).max(100),
      }),
    )
    .optional(),
  preferredCertifications: z.array(z.string()).optional(),
  published: z.boolean().optional(),
  status: z.enum(["open", "closed", "filled"]).optional(),
});

async function assertJobOrgAccess(jobId: number, userOrgId: number | null, role: string) {
  const job = await getJobById(jobId);
  if (!job) return { error: "Not found" as const };
  if (role === "admin") return { job };
  if (role !== "enterprise_admin" || userOrgId === null || job.organizationId !== userOrgId) {
    return { error: "Forbidden" as const };
  }
  return { job };
}

export async function GET(
  _request: Request,
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
  const job = await getJobById(jobId);
  if (!job) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const role = session.user.role ?? "student";
  const orgId =
    session.user.organizationId === null || session.user.organizationId === undefined
      ? null
      : Number(session.user.organizationId);
  const isOwner =
    role === "admin" || (role === "enterprise_admin" && orgId === job.organizationId);
  if (!isOwner && (!job.published || job.status !== "open")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ job });
}

export async function PUT(
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

  const role = session.user.role ?? "student";
  const orgId =
    session.user.organizationId === null || session.user.organizationId === undefined
      ? null
      : Number(session.user.organizationId);
  const access = await assertJobOrgAccess(jobId, orgId, role);
  if ("error" in access && access.error === "Not found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if ("error" in access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

  const row = await updateJob(jobId, parsed.data);
  return NextResponse.json({ job: row });
}

export async function DELETE(
  _request: Request,
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
  const role = session.user.role ?? "student";
  const orgId =
    session.user.organizationId === null || session.user.organizationId === undefined
      ? null
      : Number(session.user.organizationId);
  const access = await assertJobOrgAccess(jobId, orgId, role);
  if ("error" in access && access.error === "Not found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if ("error" in access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const row = await updateJob(jobId, { status: "closed" });
  return NextResponse.json({ job: row });
}
