/**
 * Comprehensive demo seed (idempotent where possible).
 * Run after migrations and base `db:seed` for scenarios.
 *
 *   npm run db:seed:enhanced
 */
import bcrypt from "bcryptjs";
import { addMilliseconds, subDays } from "date-fns";
import { and, count, eq } from "drizzle-orm";

import { db, postgresClient } from "@/db";
import {
  jobApplications,
  jobs,
  mentorConversations,
  organizations,
  scenarios,
  sessionEvents,
  skillAssessments,
  trainingSessions,
  users,
} from "@/db/schema";

const PASSWORD = "demo123";
const ROUNDS = 10;

async function main(): Promise<void> {
  const scenarioRows = await db.select({ id: scenarios.id }).from(scenarios).limit(20);
  if (scenarioRows.length === 0) {
    throw new Error("No scenarios found. Run `npm run db:seed` first.");
  }
  const scenarioIds = scenarioRows.map((r) => r.id);

  const orgRows = [
    { name: "CyberCorp Industries", slug: "cybercorp-industries", plan: "enterprise" as const, seatLimit: 25 },
    { name: "State University", slug: "state-university", plan: "academic" as const, seatLimit: 100 },
    { name: "Free Learners", slug: "free-learners", plan: "free" as const, seatLimit: 5 },
  ];

  const orgMap = new Map<string, number>();
  for (const o of orgRows) {
    const existing = await db.query.organizations.findFirst({ where: eq(organizations.slug, o.slug) });
    if (existing) {
      orgMap.set(o.slug, existing.id);
      continue;
    }
    const [ins] = await db.insert(organizations).values(o).returning();
    if (ins) orgMap.set(o.slug, ins.id);
  }

  const cyber = orgMap.get("cybercorp-industries");
  const uni = orgMap.get("state-university");
  const free = orgMap.get("free-learners");
  if (!cyber || !uni || !free) throw new Error("Organizations missing after upsert.");

  const passwordHash = await bcrypt.hash(PASSWORD, ROUNDS);

  type SeedUserRow = {
    email: string;
    name: string;
    role: "student" | "instructor" | "admin" | "enterprise_admin";
    organizationId: number | null;
  };

  const seedUsers: SeedUserRow[] = [
    { email: "admin@sentinelforge.com", name: "Platform Admin", role: "admin" as const, organizationId: null as number | null },
    { email: "eadmin@cybercorp.demo", name: "Morgan Blake", role: "enterprise_admin" as const, organizationId: cyber },
    { email: "eadmin@university.demo", name: "Riley Stone", role: "enterprise_admin" as const, organizationId: uni },
    { email: "inst1@cybercorp.demo", name: "Casey Ng", role: "instructor" as const, organizationId: cyber },
    { email: "inst2@cybercorp.demo", name: "Drew Ortiz", role: "instructor" as const, organizationId: cyber },
    { email: "inst1@university.demo", name: "Dr. Sam Wells", role: "instructor" as const, organizationId: uni },
    { email: "inst2@university.demo", name: "Dr. Avery Kim", role: "instructor" as const, organizationId: uni },
  ];

  for (let i = 1; i <= 15; i += 1) {
    const org = i <= 8 ? cyber : i <= 13 ? uni : free;
    seedUsers.push({
      email: `student${i}@demo.sf`,
      name: `Student ${i}`,
      role: "student",
      organizationId: org,
    });
  }

  const userIds: number[] = [];
  for (const u of seedUsers) {
    const ex = await db.query.users.findFirst({ where: eq(users.email, u.email) });
    if (ex) {
      userIds.push(ex.id);
      continue;
    }
    const [row] = await db
      .insert(users)
      .values({ ...u, passwordHash })
      .returning({ id: users.id });
    if (row) userIds.push(row.id);
  }

  const student1 = await db.query.users.findFirst({ where: eq(users.email, "student1@demo.sf") });
  if (!student1?.organizationId) {
    throw new Error("Expected student1@demo.sf after user seed.");
  }

  const existingSessions = await db.query.trainingSessions.findMany({
    where: eq(trainingSessions.userId, student1.id),
    limit: 5,
  });
  if (existingSessions.length >= 5) {
    console.log("Enhanced sessions already present; skipping bulk session insert.");
    return;
  }

  const statuses: Array<"completed" | "running" | "abandoned" | "pending"> = [
    "completed",
    "completed",
    "completed",
    "running",
    "abandoned",
    "pending",
  ];

  for (let i = 0; i < 50; i += 1) {
    const uid = userIds[(i % userIds.length) + 0] ?? userIds[0]!;
    const urow = await db.query.users.findFirst({ where: eq(users.id, uid) });
    const orgId = urow?.organizationId ?? cyber;
    const scenarioId = scenarioIds[i % scenarioIds.length]!;
    const status = statuses[i % statuses.length];
    const daysAgo = (i * 3) % 90;
    const created = subDays(new Date(), daysAgo);
    const completed =
      status === "completed"
        ? addMilliseconds(created, 86_400_000)
        : status === "abandoned"
          ? addMilliseconds(created, 3_600_000)
          : null;
    const [sess] = await db
      .insert(trainingSessions)
      .values({
        userId: uid,
        scenarioId,
        organizationId: orgId,
        status,
        finalScore: status === "completed" ? 60 + (i % 36) : null,
        timeSpent: status === "completed" ? 600 + (i % 400) : null,
        startedAt: created,
        completedAt: completed,
        createdAt: created,
      })
      .returning({ id: trainingSessions.id });

    if (!sess) continue;
    if (status === "completed") {
      await db.insert(sessionEvents).values([
        { sessionId: sess.id, eventType: "environment_ready", payload: { seeded: true }, createdAt: created },
        { sessionId: sess.id, eventType: "flag_submitted", payload: { submitted: "SF{wrong}" }, createdAt: addMilliseconds(created, 3_600_000) },
        { sessionId: sess.id, eventType: "flag_incorrect", payload: {}, createdAt: addMilliseconds(created, 3_600_000) },
        {
          sessionId: sess.id,
          eventType: "flag_correct",
          payload: { flagId: "flag-1" },
          createdAt: addMilliseconds(created, 7_200_000),
        },
        {
          sessionId: sess.id,
          eventType: "session_completed",
          payload: { totalScore: 60 + (i % 36), grade: "B" },
          createdAt: completed ?? addMilliseconds(created, 10_800_000),
        },
      ]);
    }
  }

  const [{ c: skillCount }] = await db.select({ c: count() }).from(skillAssessments);
  if (Number(skillCount) < 300) {
    const categories = [
      "network_security",
      "web_security",
      "forensics",
      "incident_response",
      "malware_analysis",
      "cloud_security",
    ] as const;
    for (const uid of userIds.slice(0, 12)) {
      for (let c = 0; c < 6; c += 1) {
        await db.insert(skillAssessments).values({
          userId: uid,
          category: categories[c % categories.length],
          skill: `skill_${c}`,
          score: 55 + ((uid + c) % 40),
          confidence: "0.75",
        });
      }
    }
  }

  const [{ c: mentorCount }] = await db.select({ c: count() }).from(mentorConversations);
  if (Number(mentorCount) < 40) {
    const completedSessions = await db.query.trainingSessions.findMany({
      where: eq(trainingSessions.status, "completed"),
      limit: 30,
    });
    for (const s of completedSessions) {
      await db.insert(mentorConversations).values([
        { sessionId: s.id, role: "user", content: "I'm stuck on lateral movement.", createdAt: s.createdAt },
        {
          sessionId: s.id,
          role: "mentor",
          content: "Review the service accounts on the pivot host and look for reused passwords.",
          createdAt: addMilliseconds(s.createdAt, 3_600_000),
        },
      ]);
    }
  }

  const jobTitles = [
    "Junior SOC Analyst",
    "Threat Hunter",
    "Security Engineer",
    "Incident Responder",
    "Security Intern",
  ];
  const orgsForJobs = [cyber, cyber, cyber, uni, cyber];
  const jobIds: number[] = [];
  for (let j = 0; j < jobTitles.length; j += 1) {
    const ex = await db.query.jobs.findFirst({ where: eq(jobs.title, jobTitles[j]!) });
    if (ex) {
      jobIds.push(ex.id);
      continue;
    }
    const [job] = await db
      .insert(jobs)
      .values({
        organizationId: orgsForJobs[j]!,
        title: jobTitles[j]!,
        description: `${jobTitles[j]} — seeded role for hiring demo.`,
        requiredSkills: ["network_security", "incident_response"],
        location: "Remote",
        salaryRange: "Competitive",
        jobType: "full-time",
        experienceLevel: "mid",
      })
      .returning({ id: jobs.id });
    if (job) jobIds.push(job.id);
  }

  const appStatuses = ["applied", "reviewing", "interview", "offered", "rejected"] as const;
  for (let a = 0; a < 12; a += 1) {
    const jobId = jobIds[a % jobIds.length]!;
    const applicant = userIds[(a + 3) % userIds.length]!;
    const dup = await db.query.jobApplications.findFirst({
      where: and(eq(jobApplications.jobId, jobId), eq(jobApplications.userId, applicant)),
    });
    if (dup) continue;
    await db.insert(jobApplications).values({
      jobId,
      userId: applicant,
      matchScore: 55 + (a % 41),
      status: appStatuses[a % appStatuses.length],
    });
  }

  console.log("Enhanced seed completed. Try admin@sentinelforge.com / demo123 (or existing admin password if unchanged).");
}

main()
  .then(async () => {
    await postgresClient.end({ timeout: 5 });
    process.exit(0);
  })
  .catch(async (e) => {
    console.error(e);
    await postgresClient.end({ timeout: 5 }).catch(() => undefined);
    process.exit(1);
  });
