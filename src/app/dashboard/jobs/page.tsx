import type { Metadata } from "next";
import type { ReactElement } from "react";

import { auth } from "@/auth";
import { getOpenJobs, listApplicationsForUser } from "@/db/queries";
import { getUserSkillMatrix } from "@/lib/agents/evaluator/skill-matrix";
import { placementAgent } from "@/lib/agents/placement";

import { JobsBoard } from "./jobs-board";

export const metadata: Metadata = {
  title: "Job opportunities | SentinelForge",
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{
    location?: string;
    jobType?: string;
    experienceLevel?: string;
    search?: string;
  }>;
}): Promise<ReactElement> {
  const sp = await searchParams;
  const session = await auth();
  const userId = Number(session!.user!.id);

  const jobs = await getOpenJobs({
    locationContains: sp.location,
    jobType: sp.jobType,
    experienceLevel: sp.experienceLevel,
    search: sp.search,
  });

  const matrix = await getUserSkillMatrix(userId);
  const categoryScores = Object.fromEntries(matrix.map((c) => [c.name, c.averageScore]));

  const enriched = [];
  for (const job of jobs) {
    enriched.push({ job, match: await placementAgent.calculateMatch(userId, job.id) });
  }

  const applications = await listApplicationsForUser(userId);

  return (
    <JobsBoard
      initialJobs={enriched}
      applications={applications}
      categoryScores={categoryScores}
      filterDefaults={{
        location: sp.location ?? "",
        jobType: sp.jobType ?? "all",
        experienceLevel: sp.experienceLevel ?? "all",
        search: sp.search ?? "",
      }}
    />
  );
}
