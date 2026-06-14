import bcrypt from "bcryptjs";
import { count, eq, type InferSelectModel } from "drizzle-orm";

import { db, postgresClient } from "@/db";
import {
  jobs,
  organizations,
  scenarios,
  skillAssessments,
  users,
} from "@/db/schema";

const DEV_PASSWORD = "password123";
const BCRYPT_ROUNDS = 10;

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function seedOrganizations() {
  const rows = [
    {
      name: "Acme Corp",
      slug: "acme-corp",
      plan: "enterprise" as const,
      seatLimit: 500,
    },
    {
      name: "State University",
      slug: "state-university",
      plan: "academic" as const,
      seatLimit: 200,
    },
    {
      name: "Free Learners",
      slug: "free-learners",
      plan: "free" as const,
      seatLimit: 5,
    },
  ];

  const created: InferSelectModel<typeof organizations>[] = [];
  for (const row of rows) {
    const existing = await db.query.organizations.findFirst({
      where: eq(organizations.slug, row.slug),
    });
    if (existing) {
      console.log(`Organization already exists: ${row.slug}`);
      created.push(existing);
      continue;
    }
    const [inserted] = await db.insert(organizations).values(row).returning();
    if (inserted) {
      console.log(`Created organization: ${inserted.name}`);
      created.push(inserted);
    }
  }
  return created;
}

async function seedUsers(
  orgs: { id: number; slug: string }[],
): Promise<Map<string, number>> {
  const acme = orgs.find((o) => o.slug === "acme-corp");
  const uni = orgs.find((o) => o.slug === "state-university");
  const free = orgs.find((o) => o.slug === "free-learners");

  if (!acme || !uni || !free) {
    throw new Error("Expected all three organizations to exist before seeding users.");
  }

  const passwordHash = await hashPassword(DEV_PASSWORD);

  const seedUsersInput = [
    {
      email: "admin@sentinelforge.com",
      name: "Platform Admin",
      passwordHash,
      role: "admin" as const,
      organizationId: null as number | null,
    },
    {
      email: "enterprise.admin@acme.com",
      name: "Acme Enterprise Admin",
      passwordHash,
      role: "enterprise_admin" as const,
      organizationId: acme.id,
    },
    {
      email: "instructor1@state.edu",
      name: "Dr. Jordan Lee",
      passwordHash,
      role: "instructor" as const,
      organizationId: uni.id,
    },
    {
      email: "instructor2@acme.com",
      name: "Sam Rivera",
      passwordHash,
      role: "instructor" as const,
      organizationId: acme.id,
    },
    {
      email: "student1@state.edu",
      name: "Alex Chen",
      passwordHash,
      role: "student" as const,
      organizationId: uni.id,
    },
    {
      email: "student2@state.edu",
      name: "Jamie Patel",
      passwordHash,
      role: "student" as const,
      organizationId: uni.id,
    },
    {
      email: "student3@acme.com",
      name: "Taylor Morgan",
      passwordHash,
      role: "student" as const,
      organizationId: acme.id,
    },
    {
      email: "student4@acme.com",
      name: "Riley Brooks",
      passwordHash,
      role: "student" as const,
      organizationId: acme.id,
    },
    {
      email: "student5@free-learners.dev",
      name: "Casey Nguyen",
      passwordHash,
      role: "student" as const,
      organizationId: free.id,
    },
  ];

  const idByEmail = new Map<string, number>();

  for (const u of seedUsersInput) {
    const existing = await db.query.users.findFirst({
      where: eq(users.email, u.email),
    });
    if (existing) {
      console.log(`User already exists: ${u.email}`);
      idByEmail.set(u.email, existing.id);
      continue;
    }
    const [inserted] = await db.insert(users).values(u).returning();
    if (inserted) {
      console.log(`Created user: ${inserted.email}`);
      idByEmail.set(inserted.email, inserted.id);
    }
  }

  return idByEmail;
}

async function seedScenarios(adminUserId: number) {
  const seedRows: (typeof scenarios.$inferInsert)[] = [
    {
      name: "Phishing Email Analysis",
      description:
        "Analyze suspicious email headers, URLs, and social engineering cues to triage a phishing campaign.",
      difficulty: "beginner",
      category: "network_security",
      mitreTechniques: "T1566",
      estimatedDuration: 45,
      isActive: true,
      createdBy: adminUserId,
    },
    {
      name: "SQL Injection Detection",
      description:
        "Identify SQLi patterns in application logs and craft safe reproduction steps for developers.",
      difficulty: "beginner",
      category: "web_security",
      mitreTechniques: "T1190",
      estimatedDuration: 40,
      isActive: true,
      createdBy: adminUserId,
    },
    {
      name: "Lateral Movement Traces",
      description:
        "Correlate authentication artifacts to map lateral movement paths across segmented subnets.",
      difficulty: "intermediate",
      category: "network_security",
      mitreTechniques: "T1021",
      estimatedDuration: 60,
      isActive: true,
      createdBy: adminUserId,
    },
    {
      name: "Cloud Storage Misconfiguration",
      description:
        "Audit object storage policies and public ACL drift that could expose sensitive datasets.",
      difficulty: "intermediate",
      category: "cloud_security",
      mitreTechniques: "T1530",
      estimatedDuration: 55,
      isActive: true,
      createdBy: adminUserId,
    },
    {
      name: "Ransomware Behavior Analysis",
      description:
        "Review endpoint telemetry for encryption loops, shadow copy tampering, and ransom note staging.",
      difficulty: "advanced",
      category: "malware_analysis",
      mitreTechniques: "T1486",
      estimatedDuration: 90,
      isActive: true,
      createdBy: adminUserId,
    },
    {
      name: "Memory Forensics Challenge",
      description:
        "Extract credentials and attacker tooling indicators from a provided memory capture.",
      difficulty: "advanced",
      category: "forensics",
      mitreTechniques: "T1003",
      estimatedDuration: 120,
      isActive: true,
      createdBy: adminUserId,
    },
    {
      name: "APT IOC Hunt",
      description:
        "Pivot from a single network IOC to uncover C2 infrastructure and persistence mechanisms.",
      difficulty: "expert",
      category: "incident_response",
      mitreTechniques: "T1071",
      estimatedDuration: 150,
      isActive: true,
      createdBy: adminUserId,
    },
    {
      name: "Zero-Day Exploit Simulation",
      description:
        "Walk through a controlled exploit chain against a vulnerable web service with safe mitigations.",
      difficulty: "expert",
      category: "web_security",
      mitreTechniques: "T1190,T1059",
      estimatedDuration: 180,
      isActive: true,
      createdBy: adminUserId,
    },
    {
      name: "Active Directory Recon",
      description:
        "Identify LDAP and Kerberos reconnaissance activity indicative of pre-compromise enumeration.",
      difficulty: "intermediate",
      category: "network_security",
      mitreTechniques: "T1087",
      estimatedDuration: 70,
      isActive: true,
      createdBy: adminUserId,
    },
    {
      name: "Supply Chain Compromise",
      description:
        "Trace a compromised dependency update through CI/CD artifacts and package provenance signals.",
      difficulty: "advanced",
      category: "network_security",
      mitreTechniques: "T1195",
      estimatedDuration: 100,
      isActive: true,
      createdBy: adminUserId,
    },
  ];

  let insertedCount = 0;
  for (const row of seedRows) {
    const existing = await db.query.scenarios.findFirst({
      where: eq(scenarios.name, row.name),
    });
    if (existing) {
      console.log(`Scenario already exists: ${row.name}`);
      continue;
    }
    await db.insert(scenarios).values(row);
    insertedCount += 1;
    console.log(`Created scenario: ${row.name}`);
  }

  if (insertedCount === 0 && seedRows.length > 0) {
    const total = await db.select({ c: scenarios.id }).from(scenarios);
    console.log(`Scenarios table row count (ids fetched): ${total.length}`);
  }
}

async function seedSkillAssessments(userIds: number[]) {
  if (userIds.length === 0) {
    return;
  }

  const probeUserId = userIds[0];
  if (probeUserId === undefined) {
    return;
  }

  const existing = await db.query.skillAssessments.findFirst({
    where: eq(skillAssessments.userId, probeUserId),
  });
  if (existing) {
    console.log("Skill assessments already present, skipping demo insert.");
    return;
  }

  const samples: (typeof skillAssessments.$inferInsert)[] = [];

  for (const userId of userIds) {
    samples.push(
      {
        userId,
        category: "network_security",
        skill: "Packet analysis",
        score: 72,
        confidence: "0.82",
      },
      {
        userId,
        category: "web_security",
        skill: "OWASP Top 10 triage",
        score: 65,
        confidence: "0.74",
      },
      {
        userId,
        category: "incident_response",
        skill: "Timeline construction",
        score: 58,
        confidence: "0.61",
      },
    );
  }

  await db.insert(skillAssessments).values(samples);
  console.log(`Inserted ${samples.length} skill assessment rows.`);
}

async function seedJobs(acmeOrgId: number) {
  const rows: (typeof jobs.$inferInsert)[] = [
    {
      organizationId: acmeOrgId,
      title: "Security Operations Analyst II",
      description:
        "Monitor enterprise telemetry, tune detection content, and lead incident bridge calls for critical alerts.",
      requiredSkills: [
        { key: "network_security", label: "Network security", minScore: 65 },
        { key: "incident_response", label: "Incident response", minScore: 60 },
      ],
      location: "Remote (US)",
      salaryRange: "USD 110k–140k",
      jobType: "full_time",
      experienceLevel: "mid",
      preferredCertifications: ["soc_analyst_1"],
      published: true,
      status: "open",
    },
    {
      organizationId: acmeOrgId,
      title: "Application Security Engineer",
      description:
        "Partner with product teams on threat modeling, secure SDLC gates, and vulnerability management.",
      requiredSkills: [
        { key: "web_security", label: "Web security", minScore: 70 },
        { key: "network_security", label: "Network security", minScore: 55 },
      ],
      location: "Austin, TX",
      salaryRange: "USD 130k–165k",
      jobType: "full_time",
      experienceLevel: "senior",
      preferredCertifications: ["soc_analyst_2"],
      published: true,
      status: "open",
    },
    {
      organizationId: acmeOrgId,
      title: "Incident Response Lead",
      description:
        "Lead tabletop exercises, coordinate containment for major incidents, and mentor junior responders.",
      requiredSkills: [
        { key: "incident_response", label: "Incident response", minScore: 75 },
        { key: "forensics", label: "Forensics", minScore: 65 },
      ],
      location: "Hybrid — New York, NY",
      salaryRange: "USD 160k–195k",
      jobType: "full_time",
      experienceLevel: "senior",
      preferredCertifications: ["incident_responder", "threat_hunter"],
      published: true,
      status: "open",
    },
  ];

  for (const job of rows) {
    const existing = await db.query.jobs.findFirst({
      where: eq(jobs.title, job.title),
    });
    if (existing) {
      console.log(`Job already exists: ${job.title}`);
      continue;
    }
    await db.insert(jobs).values(job);
    console.log(`Created job: ${job.title}`);
  }
}

async function main(): Promise<void> {
  console.log("Starting database seed…");
  try {
    const orgs = await seedOrganizations();
    const userMap = await seedUsers(orgs);

    const adminId = userMap.get("admin@sentinelforge.com");
    if (!adminId) {
      throw new Error("Admin user missing after seed; cannot attach scenarios.");
    }

    await seedScenarios(adminId);

    const demoUserIds = [
      userMap.get("student1@state.edu"),
      userMap.get("student3@acme.com"),
      userMap.get("enterprise.admin@acme.com"),
    ].filter((v): v is number => typeof v === "number");

    if (demoUserIds.length > 0) {
      await seedSkillAssessments(demoUserIds);
    }

    const acme = orgs.find((o) => o.slug === "acme-corp");
    if (acme) {
      await seedJobs(acme.id);
    }

    const [{ total: scenarioTotal }] = await db
      .select({ total: count() })
      .from(scenarios);
    console.log(`Total scenarios in database: ${scenarioTotal}`);
    console.log("Seed completed successfully.");
  } catch (error) {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  }
}

main()
  .then(async () => {
    await postgresClient.end({ timeout: 5 });
    process.exit(process.exitCode ?? 0);
  })
  .catch(async (error) => {
    console.error(error);
    await postgresClient.end({ timeout: 5 }).catch(() => undefined);
    process.exit(1);
  });
