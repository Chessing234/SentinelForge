import { desc, eq, and } from "drizzle-orm";

import { db } from "@/db/index";
import { jobApplications, jobs } from "@/db/schema";
import {
  calculateMatch,
  findCandidates,
  type MatchResult,
} from "@/lib/agents/placement/matcher";
import {
  createApplication,
  findUserApplication,
  getJobById,
  listPublicCandidateUserIds,
  updateApplication,
} from "@/db/queries";

export type { MatchResult, JobRequiredSkill, MatchRecommendation } from "@/lib/agents/placement/matcher";

export class PlacementAgent {
  async calculateMatch(userId: number, jobId: number): Promise<MatchResult> {
    const job = await getJobById(jobId);
    if (!job) {
      throw new Error("Job not found");
    }
    return calculateMatch(userId, job);
  }

  async findCandidates(jobId: number, minScore?: number): Promise<MatchResult[]> {
    const job = await getJobById(jobId);
    if (!job) {
      throw new Error("Job not found");
    }
    const ids = await listPublicCandidateUserIds();
    return findCandidates(job, ids, minScore ?? 60);
  }

  async recommendJobs(userId: number, limit = 12): Promise<(typeof jobs.$inferSelect)[]> {
    const rows = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.status, "open"), eq(jobs.published, true)))
      .orderBy(desc(jobs.createdAt))
      .limit(80);

    const scored: { job: (typeof rows)[number]; score: number }[] = [];
    for (const job of rows) {
      const m = await calculateMatch(userId, job);
      scored.push({ job, score: m.overallScore });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.job);
  }

  async apply(userId: number, jobId: number): Promise<typeof jobApplications.$inferSelect> {
    const job = await getJobById(jobId);
    if (!job || job.status !== "open" || !job.published) {
      throw new Error("Job is not accepting applications");
    }
    const match = await calculateMatch(userId, job);
    const existing = await findUserApplication(jobId, userId);
    if (existing) {
      if (existing.status === "withdrawn" || existing.status === "rejected") {
        const [row] = await db
          .update(jobApplications)
          .set({
            status: "applied",
            matchScore: match.overallScore,
            appliedAt: new Date(),
          })
          .where(eq(jobApplications.id, existing.id))
          .returning();
        if (!row) throw new Error("Could not update application");
        return row;
      }
      throw new Error("Already applied to this job");
    }
    const row = await createApplication({
      jobId,
      userId,
      matchScore: match.overallScore,
      status: "applied",
    });
    if (!row) throw new Error("Could not create application");
    return row;
  }

  async updateApplicationStatus(
    appId: number,
    status: (typeof jobApplications.$inferSelect)["status"],
    actingUserOrgId: number | null,
    opts?: { admin?: boolean },
  ): Promise<void> {
    const row = await db.query.jobApplications.findFirst({
      where: eq(jobApplications.id, appId),
      with: { job: true },
    });
    if (!row?.job) throw new Error("Application not found");
    if (!opts?.admin) {
      if (actingUserOrgId === null || row.job.organizationId !== actingUserOrgId) {
        throw new Error("Forbidden");
      }
    }
    await updateApplication(appId, { status });
  }
}

export const placementAgent = new PlacementAgent();
