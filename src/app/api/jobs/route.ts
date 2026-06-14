import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  createJob,
  getOpenJobs,
  listJobsForOrganization,
} from "@/db/queries";

const jobRequiredSkillSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  minScore: z.number().min(0).max(100),
});

const createJobSchema = z.object({
  title: z.string().min(2).max(255),
  description: z.string().min(10),
  location: z.string().max(255).optional().nullable(),
  salaryRange: z.string().max(100).optional().nullable(),
  jobType: z.string().max(64).optional().nullable(),
  experienceLevel: z.string().max(64).optional().nullable(),
  requiredSkills: z.array(jobRequiredSkillSchema).min(1),
  preferredCertifications: z.array(z.string()).optional(),
  published: z.boolean().optional(),
  status: z.enum(["open", "closed", "filled"]).optional(),
});

export async function GET(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const organizationId = url.searchParams.get("organizationId");
  const status = url.searchParams.get("status");
  const role = session.user.role ?? "student";

  if (organizationId) {
    const orgId = Number(organizationId);
    if (!Number.isFinite(orgId)) {
      return NextResponse.json({ error: "Invalid organizationId" }, { status: 400 });
    }
    const selfOrg = session.user.organizationId;
    const isAdmin = role === "admin";
    const isEnterprise = role === "enterprise_admin";
    if (!isAdmin && (!isEnterprise || Number(selfOrg) !== orgId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    let jobs = await listJobsForOrganization(orgId);
    if (status && status !== "all") {
      jobs = jobs.filter((j) => j.status === status);
    }
    return NextResponse.json({ jobs });
  }

  const jobs = await getOpenJobs({
    locationContains: url.searchParams.get("location") ?? undefined,
    jobType: url.searchParams.get("jobType") ?? undefined,
    experienceLevel: url.searchParams.get("experienceLevel") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
  });
  return NextResponse.json({ jobs });
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.user.role ?? "student";
  if (role !== "enterprise_admin" && role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orgId = session.user.organizationId;
  if (orgId === null || orgId === undefined) {
    return NextResponse.json({ error: "Organization required" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createJobSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const row = await createJob({
    organizationId: Number(orgId),
    title: parsed.data.title,
    description: parsed.data.description,
    location: parsed.data.location ?? null,
    salaryRange: parsed.data.salaryRange ?? null,
    jobType: parsed.data.jobType ?? null,
    experienceLevel: parsed.data.experienceLevel ?? null,
    requiredSkills: parsed.data.requiredSkills,
    preferredCertifications: parsed.data.preferredCertifications ?? [],
    published: parsed.data.published ?? true,
    status: parsed.data.status ?? "open",
  });

  return NextResponse.json({ job: row });
}
