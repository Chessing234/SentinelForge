import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import { auth } from "@/auth";
import {
  avgMatchScoreForOrgJobs,
  countApplicantsForOrgJobs,
  countOpenJobsForOrganization,
  getJobPostingStats,
  getOrganizationById,
  getTopSkillCategoriesForUsers,
  listApplicationsForOrganization,
  listJobsForOrganization,
  listOrganizationsForAdmin,
  listUserCertificationsByUserIds,
  listUserTrainingHistory,
} from "@/db/queries";
import { getUserSkillMatrix } from "@/lib/agents/evaluator/skill-matrix";
import { parseRequiredSkills } from "@/lib/agents/placement/parse-job-skills";
import { placementAgent } from "@/lib/agents/placement";
import { canAccessHiringPortal } from "@/lib/role-access";
import type { Role } from "@/types";

import { HiringDashboard } from "./hiring-dashboard";

export const metadata: Metadata = {
  title: "Hiring portal | SentinelForge",
};

export default async function HiringPage({
  searchParams,
}: {
  searchParams: Promise<{ organizationId?: string }>;
}): Promise<ReactElement> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  const role = (session.user.role ?? "student") as Role;
  if (!canAccessHiringPortal(role)) {
    redirect("/dashboard");
  }

  const sp = await searchParams;
  let orgId: number | null = null;
  let organizationsMeta: { id: number; name: string }[] | undefined;

  if (role === "admin") {
    const orgs = await listOrganizationsForAdmin();
    organizationsMeta = orgs.map((o) => ({ id: o.id, name: o.name }));
    const param = sp.organizationId ? Number(sp.organizationId) : null;
    if (param && orgs.some((o) => o.id === param)) {
      orgId = param;
    } else if (session.user.organizationId != null) {
      orgId = Number(session.user.organizationId);
    } else if (orgs[0]) {
      orgId = orgs[0].id;
    }
  } else {
    orgId =
      session.user.organizationId === null || session.user.organizationId === undefined
        ? null
        : Number(session.user.organizationId);
  }

  if (!orgId) {
    redirect("/dashboard");
  }

  const orgRow = await getOrganizationById(orgId);
  const orgName = orgRow?.name ?? "Organization";

  const [jobStats, apps, jobsList, openCount, applicantCount, avgMatch] = await Promise.all([
    getJobPostingStats(orgId),
    listApplicationsForOrganization(orgId),
    listJobsForOrganization(orgId),
    countOpenJobsForOrganization(orgId),
    countApplicantsForOrgJobs(orgId),
    avgMatchScoreForOrgJobs(orgId),
  ]);

  const userIds = [...new Set(apps.map((a) => a.user.id))];
  const [certRows, histories, matrices, topSkills] = await Promise.all([
    listUserCertificationsByUserIds(userIds),
    Promise.all(userIds.map((id) => listUserTrainingHistory(id))),
    Promise.all(userIds.map((id) => getUserSkillMatrix(id))),
    getTopSkillCategoriesForUsers(userIds),
  ]);

  const matrixByUser = new Map(userIds.map((id, i) => [id, matrices[i]!]));
  const historyByUser = new Map(userIds.map((id, i) => [id, histories[i]!]));
  const certsByUser = new Map<number, string[]>();
  for (const c of certRows) {
    const list = certsByUser.get(c.userId) ?? [];
    list.push(c.certificationId);
    certsByUser.set(c.userId, list);
  }

  const candidateRows = await Promise.all(
    apps.map(async (row) => {
      const match = await placementAgent.calculateMatch(row.user.id, row.application.jobId);
      const reqs = parseRequiredSkills(row.job.requiredSkills);
      const m = matrixByUser.get(row.user.id) ?? [];
      const cat = new Map(m.map((c) => [c.name, c.averageScore]));
      const skillRows = reqs.map((r) => ({
        key: r.key,
        label: r.label,
        required: r.minScore,
        actual: cat.get(r.key) ?? 0,
      }));
      const top = (topSkills.get(row.user.id) ?? [])
        .map((x) => `${x.category.replace(/_/g, " ")} (${x.avgScore})`)
        .join(", ");
      const h = historyByUser.get(row.user.id) ?? [];
      const trainingSummary = `${h.length} completed training sessions on SentinelForge.`;
      return {
        applicationId: row.application.id,
        jobId: row.job.id,
        jobTitle: row.job.title,
        name: row.user.name,
        email: row.user.email,
        image: row.user.image,
        location: row.user.profileLocation,
        status: row.application.status,
        matchScore: row.application.matchScore,
        match: {
          overallScore: match.overallScore,
          skillMatch: match.skillMatch,
          experienceMatch: match.experienceMatch,
          certificationMatch: match.certificationMatch,
          skillRows,
        },
        certificationIds: certsByUser.get(row.user.id) ?? [],
        topSkills: top || "—",
        trainingSummary,
      };
    }),
  );

  return (
    <HiringDashboard
      organizationId={orgId}
      role={role}
      organizationName={orgName}
      organizations={organizationsMeta}
      stats={{
        openPositions: openCount,
        totalApplicants: applicantCount,
        avgMatch,
        timeToHireLabel: "—",
      }}
      jobRows={jobStats}
      jobsForModal={jobsList}
      candidates={candidateRows}
    />
  );
}
