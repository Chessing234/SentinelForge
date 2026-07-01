/**
 * Comprehensive demo seed — idempotent and safe to re-run.
 *
 * Enriches the THREE advertised demo accounts (and their organizations) so that
 * every dashboard a judge visits is populated with realistic data:
 *
 *   - Student           student1@state.edu       (State University)
 *   - Enterprise admin   enterprise.admin@acme.com (Acme Corp)
 *   - Platform admin     admin@sentinelforge.com
 *
 * Populates: completed training sessions + events (attack timeline), mentor
 * conversations, skill history, certifications, and hiring matches (job
 * applications) for the students in both orgs.
 *
 * Run AFTER migrations and base `db:seed`:
 *   npm run db:seed && npm run db:seed:enhanced
 */
import bcrypt from "bcryptjs";
import { addMinutes, subDays, subHours } from "date-fns";
import { and, eq, inArray } from "drizzle-orm";

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
  userCertifications,
  users,
} from "@/db/schema";

const PASSWORD = "password123";
const ROUNDS = 10;

/** Deterministic PRNG so re-seeds produce stable, reproducible demo data. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260701);
const between = (min: number, max: number): number =>
  Math.round(min + rand() * (max - min));

type Scenario = { id: number; category: string; difficulty: string; name: string };

const SKILLS_BY_CATEGORY: Record<string, string[]> = {
  network_security: ["Packet analysis", "Traffic baselining", "Lateral movement"],
  web_security: ["OWASP Top 10 triage", "Injection analysis", "Auth bypass review"],
  cloud_security: ["IAM misconfig audit", "Storage exposure review"],
  incident_response: ["Timeline construction", "Containment planning"],
  malware_analysis: ["Static triage", "Behavioral analysis"],
  forensics: ["Memory forensics", "Artifact recovery"],
};
const CATEGORIES = Object.keys(SKILLS_BY_CATEGORY);

const MENTOR_EXCHANGES: Array<[string, string]> = [
  [
    "I'm stuck on lateral movement between the two subnets.",
    "Look at the authentication artifacts on the pivot host — check for reused service-account credentials and Kerberos ticket requests that cross the segment boundary.",
  ],
  [
    "How do I confirm this alert is a true positive?",
    "Correlate the process tree with the network beacon interval. A consistent jittered callback plus an unsigned parent process is a strong true-positive signal.",
  ],
  [
    "What should I check first in this memory capture?",
    "Start with the process list and network connections, then diff loaded modules against a known-good baseline to surface injected code.",
  ],
  [
    "The flag isn't in the obvious log file.",
    "Pivot to the artifacts the attacker touched last — staged archives and shadow-copy tampering often hide the final indicator.",
  ],
];

async function upsertUser(row: {
  email: string;
  name: string;
  role: "student" | "instructor" | "admin" | "enterprise_admin";
  organizationId: number | null;
  passwordHash: string;
}): Promise<number> {
  const existing = await db.query.users.findFirst({ where: eq(users.email, row.email) });
  if (existing) return existing.id;
  const [ins] = await db.insert(users).values(row).returning({ id: users.id });
  return ins!.id;
}

/** Give a user a full spread of skill assessments across all six categories. */
async function seedSkillsForUser(userId: number, strength: number): Promise<void> {
  const existing = await db.query.skillAssessments.findFirst({
    where: eq(skillAssessments.userId, userId),
  });
  if (existing) return;

  const rows: (typeof skillAssessments.$inferInsert)[] = [];
  for (const category of CATEGORIES) {
    for (const skill of SKILLS_BY_CATEGORY[category]!) {
      // Two data points per skill to create visible history/progression.
      const base = Math.min(96, Math.max(35, strength + between(-12, 12)));
      rows.push({
        userId,
        category,
        skill,
        score: Math.max(30, base - between(6, 16)),
        confidence: (0.6 + rand() * 0.3).toFixed(2),
        assessedAt: subDays(new Date(), between(45, 80)),
      });
      rows.push({
        userId,
        category,
        skill,
        score: base,
        confidence: (0.7 + rand() * 0.25).toFixed(2),
        assessedAt: subDays(new Date(), between(1, 20)),
      });
    }
  }
  await db.insert(skillAssessments).values(rows);
}

/** Create N completed sessions (plus a few in-flight ones) with events + mentor chat. */
async function seedSessionsForUser(
  userId: number,
  orgId: number | null,
  scenarioPool: Scenario[],
  opts: { completed: number; withMentor?: boolean },
): Promise<void> {
  const existingCompleted = await db.query.trainingSessions.findMany({
    where: and(
      eq(trainingSessions.userId, userId),
      eq(trainingSessions.status, "completed"),
    ),
    limit: opts.completed,
  });
  if (existingCompleted.length >= opts.completed) return;

  // Spread completions so that recent ones (last 1-3 days) build a streak,
  // and older ones populate score history / monthly analytics.
  const dayOffsets = [1, 2, 3, 6, 10, 16, 24, 33, 45, 60, 74, 88];

  for (let i = 0; i < opts.completed; i += 1) {
    const scenario = scenarioPool[i % scenarioPool.length]!;
    const daysAgo = dayOffsets[i % dayOffsets.length]! + Math.floor(i / dayOffsets.length) * 2;
    const startedAt = subDays(new Date(), daysAgo);
    const durationMin = between(18, 55);
    const completedAt = addMinutes(startedAt, durationMin);
    const score = between(62, 97);

    const [sess] = await db
      .insert(trainingSessions)
      .values({
        userId,
        scenarioId: scenario.id,
        organizationId: orgId,
        status: "completed",
        finalScore: score,
        timeSpent: durationMin * 60,
        startedAt,
        completedAt,
        createdAt: startedAt,
      })
      .returning({ id: trainingSessions.id });
    if (!sess) continue;

    const t = (min: number): Date => addMinutes(startedAt, min);
    await db.insert(sessionEvents).values([
      { sessionId: sess.id, eventType: "environment_ready", payload: { seeded: true }, createdAt: t(0) },
      { sessionId: sess.id, eventType: "attack_started", payload: { technique: scenario.name }, createdAt: t(2) },
      { sessionId: sess.id, eventType: "attack_detected", payload: { indicator: "suspicious_process" }, createdAt: t(5) },
      { sessionId: sess.id, eventType: "hint_requested", payload: {}, createdAt: t(8) },
      { sessionId: sess.id, eventType: "hint_given", payload: { hint: "Inspect the pivot host." }, createdAt: t(9) },
      { sessionId: sess.id, eventType: "flag_submitted", payload: { submitted: "SF{try-1}" }, createdAt: t(durationMin - 6) },
      { sessionId: sess.id, eventType: "flag_incorrect", payload: {}, createdAt: t(durationMin - 6) },
      { sessionId: sess.id, eventType: "flag_correct", payload: { flagId: "flag-1" }, createdAt: t(durationMin - 2) },
      { sessionId: sess.id, eventType: "session_completed", payload: { totalScore: score, grade: score >= 85 ? "A" : "B" }, createdAt: completedAt },
    ]);

    if (opts.withMentor && i % 2 === 0) {
      const [q, a] = MENTOR_EXCHANGES[i % MENTOR_EXCHANGES.length]!;
      await db.insert(mentorConversations).values([
        { sessionId: sess.id, role: "user", content: q, createdAt: t(6) },
        { sessionId: sess.id, role: "mentor", content: a, createdAt: t(7) },
      ]);
    }
  }

  // A single in-progress session so the "resume training" state is demoable.
  const running = await db.query.trainingSessions.findFirst({
    where: and(
      eq(trainingSessions.userId, userId),
      inArray(trainingSessions.status, ["running", "paused"]),
    ),
  });
  if (!running && opts.withMentor) {
    const scenario = scenarioPool[0]!;
    const startedAt = subHours(new Date(), 1);
    const [sess] = await db
      .insert(trainingSessions)
      .values({
        userId,
        scenarioId: scenario.id,
        organizationId: orgId,
        status: "running",
        startedAt,
        createdAt: startedAt,
      })
      .returning({ id: trainingSessions.id });
    if (sess) {
      await db.insert(sessionEvents).values([
        { sessionId: sess.id, eventType: "environment_ready", payload: { seeded: true }, createdAt: startedAt },
        { sessionId: sess.id, eventType: "attack_started", payload: { technique: scenario.name }, createdAt: addMinutes(startedAt, 1) },
      ]);
    }
  }
}

async function seedCertifications(userId: number, ids: string[]): Promise<void> {
  for (const certificationId of ids) {
    const existing = await db.query.userCertifications.findFirst({
      where: and(
        eq(userCertifications.userId, userId),
        eq(userCertifications.certificationId, certificationId),
      ),
    });
    if (existing) continue;
    await db.insert(userCertifications).values({
      userId,
      certificationId,
      earnedAt: subDays(new Date(), between(3, 40)),
    });
  }
}

async function main(): Promise<void> {
  const scenarioRows = (await db
    .select({
      id: scenarios.id,
      category: scenarios.category,
      difficulty: scenarios.difficulty,
      name: scenarios.name,
    })
    .from(scenarios)
    .limit(30)) as Scenario[];
  if (scenarioRows.length === 0) {
    throw new Error("No scenarios found. Run `npm run db:seed` first.");
  }

  const passwordHash = await bcrypt.hash(PASSWORD, ROUNDS);

  // Resolve the organizations created by the base seed.
  const acme = await db.query.organizations.findFirst({ where: eq(organizations.slug, "acme-corp") });
  const uni = await db.query.organizations.findFirst({ where: eq(organizations.slug, "state-university") });
  if (!acme || !uni) {
    throw new Error("Expected 'acme-corp' and 'state-university' orgs. Run `npm run db:seed` first.");
  }

  // Advertised demo accounts (created by base seed; upsert to be safe).
  const studentId = await upsertUser({
    email: "student1@state.edu",
    name: "Alex Chen",
    role: "student",
    organizationId: uni.id,
    passwordHash,
  });
  await upsertUser({
    email: "enterprise.admin@acme.com",
    name: "Acme Enterprise Admin",
    role: "enterprise_admin",
    organizationId: acme.id,
    passwordHash,
  });

  // Peer students so enterprise/analytics/admin dashboards are populated.
  const acmePeers = [
    "Taylor Morgan", "Riley Brooks", "Jordan Ellis", "Priya Nair",
    "Marcus Webb", "Dana Cole", "Sofia Reyes",
  ];
  const uniPeers = [
    "Jamie Patel", "Noah Kim", "Ava Torres", "Liam Osei",
    "Maya Sen", "Ethan Ford",
  ];

  const acmeStudentIds: number[] = [];
  for (let i = 0; i < acmePeers.length; i += 1) {
    const id = await upsertUser({
      email: `acme.analyst${i + 1}@acme.demo`,
      name: acmePeers[i]!,
      role: "student",
      organizationId: acme.id,
      passwordHash,
    });
    acmeStudentIds.push(id);
  }

  const uniStudentIds: number[] = [studentId];
  for (let i = 0; i < uniPeers.length; i += 1) {
    const id = await upsertUser({
      email: `su.student${i + 1}@state.demo`,
      name: uniPeers[i]!,
      role: "student",
      organizationId: uni.id,
      passwordHash,
    });
    uniStudentIds.push(id);
  }

  const acmeScenarios = scenarioRows;
  const uniScenarios = scenarioRows;

  // Headline student: rich, high-performing profile.
  await seedSkillsForUser(studentId, 82);
  await seedSessionsForUser(studentId, uni.id, uniScenarios, { completed: 12, withMentor: true });
  await seedCertifications(studentId, ["soc_analyst_1", "incident_responder", "threat_hunter"]);

  // Acme cohort.
  for (let i = 0; i < acmeStudentIds.length; i += 1) {
    const uid = acmeStudentIds[i]!;
    await seedSkillsForUser(uid, between(58, 88));
    await seedSessionsForUser(uid, acme.id, acmeScenarios, {
      completed: between(4, 9),
      withMentor: i < 2,
    });
    if (i < 3) await seedCertifications(uid, ["soc_analyst_1"]);
  }

  // State University cohort (excluding the headline student already handled).
  for (let i = 1; i < uniStudentIds.length; i += 1) {
    const uid = uniStudentIds[i]!;
    await seedSkillsForUser(uid, between(55, 82));
    await seedSessionsForUser(uid, uni.id, uniScenarios, {
      completed: between(3, 8),
      withMentor: i === 1,
    });
    if (i < 2) await seedCertifications(uid, ["soc_analyst_1"]);
  }

  // Hiring matches — applications from students to Acme's open roles.
  const acmeJobs = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.organizationId, acme.id));

  if (acmeJobs.length > 0) {
    const applicants = [studentId, ...acmeStudentIds, ...uniStudentIds.slice(1)];
    const statuses = ["applied", "reviewing", "interview", "offered", "rejected"] as const;
    let s = 0;
    for (let a = 0; a < applicants.length; a += 1) {
      const job = acmeJobs[a % acmeJobs.length]!;
      const applicant = applicants[a]!;
      const dup = await db.query.jobApplications.findFirst({
        where: and(eq(jobApplications.jobId, job.id), eq(jobApplications.userId, applicant)),
      });
      if (dup) continue;
      await db.insert(jobApplications).values({
        jobId: job.id,
        userId: applicant,
        matchScore: between(58, 96),
        status: statuses[s % statuses.length]!,
        appliedAt: subDays(new Date(), between(1, 30)),
      });
      s += 1;
    }
  }

  console.log(
    [
      "Enhanced seed completed.",
      "Demo logins (password: password123):",
      "  student1@state.edu          — Student (populated progress, sessions, certs)",
      "  enterprise.admin@acme.com   — Enterprise admin (org analytics + hiring)",
      "  admin@sentinelforge.com     — Platform admin",
    ].join("\n"),
  );
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
