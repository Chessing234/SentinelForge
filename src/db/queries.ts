import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  ne,
  or,
  sql,
} from "drizzle-orm";

import { db } from "@/db/index";
import {
  accounts,
  jobApplications,
  jobs,
  mentorConversations,
  organizations,
  scenarios,
  sessionEvents,
  skillAssessments,
  slackIntegrations,
  stripeWebhookEvents,
  trainingSessions,
  userCertifications,
  users,
} from "@/db/schema";
import type { Category, Difficulty } from "@/types";

/* -------------------------------------------------------------------------- */
/*                                    Users                                   */
/* -------------------------------------------------------------------------- */

export async function getUserByEmail(email: string) {
  return db.query.users.findFirst({
    where: eq(users.email, email),
    with: { organization: true },
  });
}

export async function getUserById(id: number) {
  return db.query.users.findFirst({
    where: eq(users.id, id),
    with: { organization: true },
  });
}

export async function createUser(data: typeof users.$inferInsert) {
  const [row] = await db.insert(users).values(data).returning();
  return row;
}

export async function updateUser(
  id: number,
  data: Partial<Omit<typeof users.$inferInsert, "id">>,
) {
  const [row] = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return row;
}

export async function getUsersByOrganization(
  orgId: number,
  opts: { limit: number; offset: number },
) {
  return db.query.users.findMany({
    where: eq(users.organizationId, orgId),
    orderBy: (u, { asc: ascFn }) => [ascFn(u.createdAt)],
    limit: opts.limit,
    offset: opts.offset,
  });
}

/* -------------------------------------------------------------------------- */
/*                               Organizations                                */
/* -------------------------------------------------------------------------- */

export async function getOrganizationBySlug(slug: string) {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, slug),
  });
  if (!org) {
    return undefined;
  }
  const [{ memberCount }] = await db
    .select({ memberCount: count() })
    .from(users)
    .where(eq(users.organizationId, org.id));
  return { ...org, memberCount };
}

export async function getOrganizationById(id: number) {
  return db.query.organizations.findFirst({
    where: eq(organizations.id, id),
  });
}

export async function createOrganization(
  data: typeof organizations.$inferInsert,
) {
  const [row] = await db.insert(organizations).values(data).returning();
  return row;
}

export async function updateOrganization(
  id: number,
  data: Partial<Omit<typeof organizations.$inferInsert, "id" | "createdAt">>,
) {
  const [row] = await db
    .update(organizations)
    .set(data)
    .where(eq(organizations.id, id))
    .returning();
  return row;
}

export async function getOrganizationMembers(orgId: number) {
  return db.query.users.findMany({
    where: eq(users.organizationId, orgId),
    orderBy: (u, { asc: ascFn }) => [ascFn(u.name)],
  });
}

/* -------------------------------------------------------------------------- */
/*                                  Scenarios                                 */
/* -------------------------------------------------------------------------- */

export type ActiveScenarioFilters = {
  difficulty?: Difficulty;
  category?: Category;
};

export async function getActiveScenarios(filters?: ActiveScenarioFilters) {
  const conditions = [eq(scenarios.isActive, true)];
  if (filters?.difficulty !== undefined) {
    conditions.push(eq(scenarios.difficulty, filters.difficulty));
  }
  if (filters?.category !== undefined) {
    conditions.push(eq(scenarios.category, filters.category));
  }
  return db
    .select()
    .from(scenarios)
    .where(and(...conditions))
    .orderBy(asc(scenarios.name));
}

export async function getScenarioById(id: number) {
  return db.query.scenarios.findFirst({
    where: eq(scenarios.id, id),
  });
}

export async function createScenario(data: typeof scenarios.$inferInsert) {
  const [row] = await db.insert(scenarios).values(data).returning();
  return row;
}

/* -------------------------------------------------------------------------- */
/*                              Training sessions                             */
/* -------------------------------------------------------------------------- */

export async function createSession(data: typeof trainingSessions.$inferInsert) {
  const [row] = await db.insert(trainingSessions).values(data).returning();
  return row;
}

export async function getSessionById(id: number) {
  return db.query.trainingSessions.findFirst({
    where: eq(trainingSessions.id, id),
    with: {
      user: true,
      scenario: true,
      events: {
        orderBy: (e, { asc: ascFn }) => [ascFn(e.createdAt)],
      },
    },
  });
}

export async function getTrainingSessionForUser(sessionId: number, userId: number) {
  return db.query.trainingSessions.findFirst({
    where: and(eq(trainingSessions.id, sessionId), eq(trainingSessions.userId, userId)),
    with: { scenario: true },
  });
}

export async function getUserSessions(userId: number) {
  return db.query.trainingSessions.findMany({
    where: eq(trainingSessions.userId, userId),
    orderBy: (s, { desc: descFn }) => [descFn(s.createdAt)],
  });
}

export async function updateSession(
  id: number,
  data: Partial<Omit<typeof trainingSessions.$inferInsert, "id">>,
) {
  const [row] = await db
    .update(trainingSessions)
    .set(data)
    .where(eq(trainingSessions.id, id))
    .returning();
  return row;
}

export async function getOrganizationSessions(orgId: number) {
  return db.query.trainingSessions.findMany({
    where: eq(trainingSessions.organizationId, orgId),
    orderBy: (s, { desc: descFn }) => [descFn(s.createdAt)],
  });
}

/* -------------------------------------------------------------------------- */
/*                               Session events                               */
/* -------------------------------------------------------------------------- */

export async function createSessionEvent(data: typeof sessionEvents.$inferInsert) {
  const [row] = await db.insert(sessionEvents).values(data).returning();
  return row;
}

export async function getSessionEvents(sessionId: number) {
  return db
    .select()
    .from(sessionEvents)
    .where(eq(sessionEvents.sessionId, sessionId))
    .orderBy(asc(sessionEvents.createdAt));
}

/* -------------------------------------------------------------------------- */
/*                            Mentor conversations                            */
/* -------------------------------------------------------------------------- */

export async function addConversationMessage(
  data: typeof mentorConversations.$inferInsert,
) {
  const [row] = await db.insert(mentorConversations).values(data).returning();
  return row;
}

export async function getConversationBySession(sessionId: number) {
  return db
    .select()
    .from(mentorConversations)
    .where(eq(mentorConversations.sessionId, sessionId))
    .orderBy(asc(mentorConversations.createdAt));
}

export async function countMentorUserMessages(sessionId: number) {
  const [{ c }] = await db
    .select({ c: count() })
    .from(mentorConversations)
    .where(
      and(eq(mentorConversations.sessionId, sessionId), eq(mentorConversations.role, "user")),
    );
  return Number(c);
}

/* -------------------------------------------------------------------------- */
/*                             Skill assessments                              */
/* -------------------------------------------------------------------------- */

export async function recordSkillAssessment(
  data: typeof skillAssessments.$inferInsert,
) {
  const [row] = await db.insert(skillAssessments).values(data).returning();
  return row;
}

export async function getUserSkillMatrix(userId: number) {
  return db
    .select({
      category: skillAssessments.category,
      avgScore: sql<number>`round(avg(${skillAssessments.score})::numeric, 0)::int`,
      skillsCount: count(),
    })
    .from(skillAssessments)
    .where(eq(skillAssessments.userId, userId))
    .groupBy(skillAssessments.category)
    .orderBy(asc(skillAssessments.category));
}

/* -------------------------------------------------------------------------- */
/*                                     Jobs                                   */
/* -------------------------------------------------------------------------- */

export type OpenJobFilters = {
  organizationId?: number;
  locationContains?: string;
  jobType?: string;
  experienceLevel?: string;
  search?: string;
};

export async function createJob(data: typeof jobs.$inferInsert) {
  const [row] = await db.insert(jobs).values(data).returning();
  return row;
}

export async function getOpenJobs(filters?: OpenJobFilters) {
  const conditions = [eq(jobs.status, "open"), eq(jobs.published, true)];
  if (filters?.organizationId !== undefined) {
    conditions.push(eq(jobs.organizationId, filters.organizationId));
  }
  if (filters?.locationContains !== undefined && filters.locationContains !== "") {
    conditions.push(isNotNull(jobs.location));
    conditions.push(ilike(jobs.location, `%${filters.locationContains}%`));
  }
  if (filters?.jobType !== undefined && filters.jobType !== "" && filters.jobType !== "all") {
    conditions.push(eq(jobs.jobType, filters.jobType));
  }
  if (
    filters?.experienceLevel !== undefined &&
    filters.experienceLevel !== "" &&
    filters.experienceLevel !== "all"
  ) {
    conditions.push(eq(jobs.experienceLevel, filters.experienceLevel));
  }
  if (filters?.search !== undefined && filters.search.trim() !== "") {
    const q = `%${filters.search.trim()}%`;
    conditions.push(or(ilike(jobs.title, q), ilike(jobs.description, q))!);
  }
  return db.query.jobs.findMany({
    where: and(...conditions),
    orderBy: (j, { desc: descFn }) => [descFn(j.createdAt)],
    with: { organization: true },
  });
}

export async function getJobById(id: number) {
  return db.query.jobs.findFirst({
    where: eq(jobs.id, id),
    with: { organization: true },
  });
}

export async function listJobsForOrganization(organizationId: number) {
  return db.query.jobs.findMany({
    where: eq(jobs.organizationId, organizationId),
    orderBy: (j, { desc: descFn }) => [descFn(j.createdAt)],
  });
}

export async function updateJob(
  id: number,
  data: Partial<Omit<typeof jobs.$inferInsert, "id">>,
) {
  const [row] = await db
    .update(jobs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(jobs.id, id))
    .returning();
  return row;
}

export async function getJobApplications(jobId: number) {
  return db.query.jobApplications.findMany({
    where: eq(jobApplications.jobId, jobId),
    orderBy: (a, { desc: descFn }) => [descFn(a.appliedAt)],
    with: { user: true },
  });
}

export async function createApplication(data: typeof jobApplications.$inferInsert) {
  const [row] = await db.insert(jobApplications).values(data).returning();
  return row;
}

export async function findUserApplication(jobId: number, userId: number) {
  return db.query.jobApplications.findFirst({
    where: and(eq(jobApplications.jobId, jobId), eq(jobApplications.userId, userId)),
  });
}

export async function listApplicationsForUser(userId: number) {
  return db.query.jobApplications.findMany({
    where: eq(jobApplications.userId, userId),
    orderBy: (a, { desc: descFn }) => [descFn(a.appliedAt)],
    with: {
      job: {
        with: { organization: true },
      },
    },
  });
}

export async function getApplicationById(id: number) {
  return db.query.jobApplications.findFirst({
    where: eq(jobApplications.id, id),
    with: { job: { with: { organization: true } }, user: true },
  });
}

export async function updateApplication(
  id: number,
  data: Partial<Omit<typeof jobApplications.$inferInsert, "id">>,
) {
  const [row] = await db.update(jobApplications).set(data).where(eq(jobApplications.id, id)).returning();
  return row;
}

export async function listPublicCandidateUserIds(): Promise<number[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.profilePublic, true));
  return rows.map((r) => r.id);
}

export async function countApplicantsForOrgJobs(organizationId: number): Promise<number> {
  const [{ c }] = await db
    .select({ c: count() })
    .from(jobApplications)
    .innerJoin(jobs, eq(jobApplications.jobId, jobs.id))
    .where(
      and(eq(jobs.organizationId, organizationId), ne(jobApplications.status, "withdrawn")),
    );
  return Number(c);
}

export async function avgMatchScoreForOrgJobs(organizationId: number): Promise<number | null> {
  const [{ avg }] = await db
    .select({
      avg: sql<number | null>`round(avg(${jobApplications.matchScore})::numeric, 1)`,
    })
    .from(jobApplications)
    .innerJoin(jobs, eq(jobApplications.jobId, jobs.id))
    .where(
      and(
        eq(jobs.organizationId, organizationId),
        isNotNull(jobApplications.matchScore),
        ne(jobApplications.status, "withdrawn"),
      ),
    );
  return avg === null ? null : Number(avg);
}

export async function countOpenJobsForOrganization(organizationId: number): Promise<number> {
  const [{ c }] = await db
    .select({ c: count() })
    .from(jobs)
    .where(and(eq(jobs.organizationId, organizationId), eq(jobs.status, "open")));
  return Number(c);
}

export type JobPostingStatRow = {
  jobId: number;
  title: string;
  status: (typeof jobs.$inferSelect)["status"];
  published: boolean;
  createdAt: Date;
  applicantCount: number;
  avgMatch: number | null;
};

export async function getJobPostingStats(organizationId: number): Promise<JobPostingStatRow[]> {
  const rows = await db
    .select({
      jobId: jobs.id,
      title: jobs.title,
      status: jobs.status,
      published: jobs.published,
      createdAt: jobs.createdAt,
      applicantCount: sql<number>`count(${jobApplications.id})::int`,
      avgMatch: sql<number | null>`round(avg(${jobApplications.matchScore})::numeric, 1)`,
    })
    .from(jobs)
    .leftJoin(
      jobApplications,
      and(eq(jobs.id, jobApplications.jobId), ne(jobApplications.status, "withdrawn")),
    )
    .where(eq(jobs.organizationId, organizationId))
    .groupBy(jobs.id);
  return rows.map((r) => ({
    jobId: r.jobId,
    title: r.title,
    status: r.status,
    published: r.published,
    createdAt: r.createdAt,
    applicantCount: Number(r.applicantCount),
    avgMatch: r.avgMatch === null ? null : Number(r.avgMatch),
  }));
}

export type OrgApplicationRow = {
  application: typeof jobApplications.$inferSelect;
  job: typeof jobs.$inferSelect;
  user: {
    id: number;
    name: string;
    email: string;
    image: string | null;
    profileLocation: string | null;
  };
};

export async function listApplicationsForOrganization(
  organizationId: number,
): Promise<OrgApplicationRow[]> {
  const rows = await db
    .select({
      application: jobApplications,
      job: jobs,
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      userImage: users.image,
      userProfileLocation: users.profileLocation,
    })
    .from(jobApplications)
    .innerJoin(jobs, eq(jobApplications.jobId, jobs.id))
    .innerJoin(users, eq(jobApplications.userId, users.id))
    .where(eq(jobs.organizationId, organizationId))
    .orderBy(desc(jobApplications.matchScore));

  return rows.map((r) => ({
    application: r.application,
    job: r.job,
    user: {
      id: r.userId,
      name: r.userName,
      email: r.userEmail,
      image: r.userImage,
      profileLocation: r.userProfileLocation,
    },
  }));
}

export async function getTopSkillCategoriesForUsers(
  userIds: number[],
  limitPerUser = 4,
): Promise<Map<number, { category: string; avgScore: number }[]>> {
  const out = new Map<number, { category: string; avgScore: number }[]>();
  if (userIds.length === 0) return out;
  const uniq = [...new Set(userIds)];
  const rows = await db
    .select({
      userId: skillAssessments.userId,
      category: skillAssessments.category,
      avgScore: sql<number>`round(avg(${skillAssessments.score})::numeric,0)::int`,
    })
    .from(skillAssessments)
    .where(inArray(skillAssessments.userId, uniq))
    .groupBy(skillAssessments.userId, skillAssessments.category);

  const grouped = new Map<number, { category: string; avgScore: number }[]>();
  for (const r of rows) {
    const list = grouped.get(r.userId) ?? [];
    list.push({ category: r.category, avgScore: r.avgScore });
    grouped.set(r.userId, list);
  }
  for (const [uid, list] of grouped) {
    list.sort((a, b) => b.avgScore - a.avgScore);
    out.set(uid, list.slice(0, limitPerUser));
  }
  return out;
}

export async function listUserCertificationsByUserIds(userIds: number[]) {
  if (userIds.length === 0) return [];
  return db
    .select()
    .from(userCertifications)
    .where(inArray(userCertifications.userId, userIds))
    .orderBy(desc(userCertifications.earnedAt));
}

export async function listUserTrainingHistory(userId: number) {
  return db.query.trainingSessions.findMany({
    where: and(eq(trainingSessions.userId, userId), eq(trainingSessions.status, "completed")),
    orderBy: (t, { desc: descFn }) => [descFn(t.completedAt)],
    with: { scenario: true },
    limit: 50,
  });
}

export async function listUserCertifications(userId: number) {
  return db
    .select()
    .from(userCertifications)
    .where(eq(userCertifications.userId, userId))
    .orderBy(desc(userCertifications.earnedAt));
}

export async function listOrganizationsForAdmin() {
  return db.select().from(organizations).orderBy(asc(organizations.name));
}

export async function listUsersForAdmin(opts: { search?: string; limit?: number }) {
  const lim = opts.limit ?? 100;
  const search = opts.search?.trim();
  if (search) {
    return db
      .select()
      .from(users)
      .where(or(ilike(users.email, `%${search}%`), ilike(users.name, `%${search}%`)))
      .orderBy(asc(users.name))
      .limit(lim);
  }
  return db.select().from(users).orderBy(asc(users.name)).limit(lim);
}

export async function listScenariosForAdmin() {
  return db.select().from(scenarios).orderBy(asc(scenarios.name));
}

export async function setScenarioActive(id: number, isActive: boolean) {
  const [row] = await db
    .update(scenarios)
    .set({ isActive })
    .where(eq(scenarios.id, id))
    .returning();
  return row;
}

export async function getPlatformStats() {
  const [{ u }] = await db.select({ u: count() }).from(users);
  const [{ s }] = await db.select({ s: count() }).from(scenarios);
  const [{ t }] = await db.select({ t: count() }).from(trainingSessions);
  return { userCount: Number(u), scenarioCount: Number(s), sessionCount: Number(t) };
}

/* -------------------------------------------------------------------------- */
/*                            Slack integrations                              */
/* -------------------------------------------------------------------------- */

export async function getSlackIntegrationByOrganizationId(organizationId: number) {
  return db.query.slackIntegrations.findFirst({
    where: eq(slackIntegrations.organizationId, organizationId),
  });
}

export async function getSlackIntegrationByTeamId(slackTeamId: string) {
  return db.query.slackIntegrations.findFirst({
    where: eq(slackIntegrations.slackTeamId, slackTeamId),
  });
}

const defaultSlackNotificationSettings = {
  trainingStarted: true,
  flagFound: true,
  sessionCompleted: true,
  weeklyDigest: true,
  incidentSimulations: true,
};

export async function upsertSlackIntegration(data: {
  organizationId: number;
  slackTeamId: string;
  slackTeamName: string | null;
  accessToken: string;
  refreshToken?: string | null;
  channelId?: string | null;
  notificationSettings?: typeof defaultSlackNotificationSettings;
}) {
  const existing = await getSlackIntegrationByOrganizationId(data.organizationId);
  if (existing) {
    const [row] = await db
      .update(slackIntegrations)
      .set({
        slackTeamId: data.slackTeamId,
        slackTeamName: data.slackTeamName,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken ?? existing.refreshToken,
        channelId: data.channelId !== undefined ? data.channelId : existing.channelId,
        notificationSettings:
          data.notificationSettings !== undefined
            ? data.notificationSettings
            : existing.notificationSettings,
        isActive: true,
      })
      .where(eq(slackIntegrations.organizationId, data.organizationId))
      .returning();
    return row;
  }
  const [row] = await db
    .insert(slackIntegrations)
    .values({
      organizationId: data.organizationId,
      slackTeamId: data.slackTeamId,
      slackTeamName: data.slackTeamName,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? null,
      channelId: data.channelId ?? null,
      notificationSettings: data.notificationSettings ?? defaultSlackNotificationSettings,
      isActive: true,
    })
    .returning();
  return row;
}

export async function updateSlackIntegrationForOrg(
  organizationId: number,
  patch: Partial<Omit<typeof slackIntegrations.$inferInsert, "id" | "organizationId">>,
) {
  const [row] = await db
    .update(slackIntegrations)
    .set(patch)
    .where(eq(slackIntegrations.organizationId, organizationId))
    .returning();
  return row;
}

export async function deleteSlackIntegration(organizationId: number) {
  await db.delete(slackIntegrations).where(eq(slackIntegrations.organizationId, organizationId));
}

export async function listActiveSlackIntegrations() {
  return db.select().from(slackIntegrations).where(eq(slackIntegrations.isActive, true));
}

export async function findUserIdBySlackAccount(slackUserId: string): Promise<number | null> {
  const row = await db.query.accounts.findFirst({
    where: and(eq(accounts.provider, "slack"), eq(accounts.providerAccountId, slackUserId)),
  });
  return row?.userId ?? null;
}

/* -------------------------------------------------------------------------- */
/*                            Billing & Stripe                                */
/* -------------------------------------------------------------------------- */

export async function claimStripeWebhookEvent(eventId: string): Promise<boolean> {
  const inserted = await db
    .insert(stripeWebhookEvents)
    .values({ eventId })
    .onConflictDoNothing({ target: stripeWebhookEvents.eventId })
    .returning({ eventId: stripeWebhookEvents.eventId });
  return inserted.length > 0;
}

export async function getOrganizationByStripeCustomerId(stripeCustomerId: string) {
  return db.query.organizations.findFirst({
    where: eq(organizations.stripeCustomerId, stripeCustomerId),
  });
}

export async function getOrganizationByStripeSubscriptionId(subscriptionId: string) {
  return db.query.organizations.findFirst({
    where: eq(organizations.stripeSubscriptionId, subscriptionId),
  });
}

export async function updateOrganizationBilling(
  organizationId: number,
  data: Partial<{
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    billingStatus: string | null;
    subscriptionPeriodEnd: Date | null;
    plan: (typeof organizations.$inferSelect)["plan"];
    seatLimit: number;
    suspended: boolean;
  }>,
) {
  const [row] = await db
    .update(organizations)
    .set(data)
    .where(eq(organizations.id, organizationId))
    .returning();
  return row;
}

/* -------------------------------------------------------------------------- */
/*                              Admin analytics                               */
/* -------------------------------------------------------------------------- */

export async function countUsersByOrganizationId(orgId: number) {
  const [{ c }] = await db
    .select({ c: count() })
    .from(users)
    .where(eq(users.organizationId, orgId));
  return Number(c);
}

export async function listOrganizationsWithMemberCounts() {
  const orgs = await db.select().from(organizations).orderBy(asc(organizations.name));
  const out = [];
  for (const o of orgs) {
    const memberCount = await countUsersByOrganizationId(o.id);
    out.push({ ...o, memberCount });
  }
  return out;
}

export async function listUsersForAdminFilters(opts: {
  search?: string;
  role?: string;
  organizationId?: number;
  limit?: number;
}) {
  const lim = opts.limit ?? 200;
  const conditions = [];
  const search = opts.search?.trim();
  if (search) {
    conditions.push(or(ilike(users.email, `%${search}%`), ilike(users.name, `%${search}%`)));
  }
  if (opts.role && opts.role !== "all") {
    conditions.push(eq(users.role, opts.role as (typeof users.$inferSelect)["role"]));
  }
  if (opts.organizationId !== undefined && opts.organizationId > 0) {
    conditions.push(eq(users.organizationId, opts.organizationId));
  }
  const where = conditions.length ? and(...conditions) : undefined;
  if (where) {
    return db.select().from(users).where(where).orderBy(asc(users.name)).limit(lim);
  }
  return db.select().from(users).orderBy(asc(users.name)).limit(lim);
}

export async function countCompletedSessionsThisMonth() {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const [{ c }] = await db
    .select({ c: count() })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.status, "completed"),
        isNotNull(trainingSessions.completedAt),
        gte(trainingSessions.completedAt, start),
      ),
    );
  return Number(c);
}

export async function countDistinctActiveUsersThisMonth() {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const rows = await db
    .selectDistinct({ userId: trainingSessions.userId })
    .from(trainingSessions)
    .where(gte(trainingSessions.createdAt, start));
  return rows.length;
}

export async function countDistinctActiveUsersThisMonthForOrg(organizationId: number) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const rows = await db
    .selectDistinct({ userId: trainingSessions.userId })
    .from(trainingSessions)
    .where(
      and(eq(trainingSessions.organizationId, organizationId), gte(trainingSessions.createdAt, start)),
    );
  return rows.length;
}

export async function countOrgCompletedSessionsThisMonth(organizationId: number) {
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const [{ c }] = await db
    .select({ c: count() })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.organizationId, organizationId),
        eq(trainingSessions.status, "completed"),
        isNotNull(trainingSessions.completedAt),
        gte(trainingSessions.completedAt, start),
      ),
    );
  return Number(c);
}
