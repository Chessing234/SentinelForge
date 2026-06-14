import { relations, sql } from "drizzle-orm";
import {
  boolean,
  decimal,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/*                                   Enums                                    */
/* -------------------------------------------------------------------------- */

export const userRoleEnum = pgEnum("user_role", [
  "student",
  "instructor",
  "admin",
  "enterprise_admin",
]);

export const organizationPlanEnum = pgEnum("organization_plan", [
  "free",
  "academic",
  "enterprise",
]);

export const scenarioDifficultyEnum = pgEnum("scenario_difficulty", [
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]);

export const scenarioCategoryEnum = pgEnum("scenario_category", [
  "network_security",
  "web_security",
  "cloud_security",
  "incident_response",
  "malware_analysis",
  "forensics",
]);

export const trainingSessionStatusEnum = pgEnum("training_session_status", [
  "pending",
  "running",
  "paused",
  "completed",
  "abandoned",
]);

export const sessionEventTypeEnum = pgEnum("session_event_type", [
  "environment_ready",
  "attack_started",
  "attack_detected",
  "hint_requested",
  "hint_given",
  "flag_submitted",
  "flag_correct",
  "flag_incorrect",
  "session_completed",
  "milestone_reached",
]);

export const mentorMessageRoleEnum = pgEnum("mentor_message_role", [
  "user",
  "mentor",
  "system",
]);

export const jobStatusEnum = pgEnum("job_status", ["open", "closed", "filled"]);

export const jobApplicationStatusEnum = pgEnum("job_application_status", [
  "applied",
  "reviewing",
  "interview",
  "offered",
  "rejected",
  "accepted",
  "withdrawn",
]);

/* -------------------------------------------------------------------------- */
/*                                   Tables                                   */
/* -------------------------------------------------------------------------- */

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  plan: organizationPlanEnum("plan").notNull().default("free"),
  seatLimit: integer("seat_limit").notNull().default(5),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  billingStatus: varchar("billing_status", { length: 64 }),
  subscriptionPeriodEnd: timestamp("subscription_period_end", { withTimezone: true }),
  suspended: boolean("suspended").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  eventId: text("event_id").primaryKey(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }),
  image: text("image"),
  emailVerified: timestamp("email_verified", {
    withTimezone: true,
    mode: "date",
  }),
  role: userRoleEnum("role").notNull().default("student"),
  organizationId: integer("organization_id").references(
    () => organizations.id,
    { onDelete: "set null" },
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  profileBio: text("profile_bio"),
  profileLocation: varchar("profile_location", { length: 255 }),
  profilePublic: boolean("profile_public").notNull().default(false),
  linkedinUrl: varchar("linkedin_url", { length: 500 }),
  portfolioUrl: text("portfolio_url"),
  resumeUrl: text("resume_url"),
  jobSearchExperienceLevel: varchar("job_search_experience_level", { length: 64 }),
  /** User-level opt-out for Slack training pings (org must still have Slack connected). */
  slackNotificationsEnabled: boolean("slack_notifications_enabled").notNull().default(true),
  notifyEmail: boolean("notify_email").notNull().default(true),
  notifyBrowser: boolean("notify_browser").notNull().default(true),
});

export const accounts = pgTable(
  "account",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const authSessions = pgTable("session", {
  sessionToken: text("session_token").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", {
    withTimezone: true,
    mode: "date",
  }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_token",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

export const scenarios = pgTable("scenarios", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  difficulty: scenarioDifficultyEnum("difficulty").notNull(),
  category: scenarioCategoryEnum("category").notNull(),
  mitreTechniques: text("mitre_techniques").notNull(),
  estimatedDuration: integer("estimated_duration").notNull().default(30),
  isActive: boolean("is_active").notNull().default(true),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const trainingSessions = pgTable("training_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  scenarioId: integer("scenario_id")
    .notNull()
    .references(() => scenarios.id, { onDelete: "no action" }),
  organizationId: integer("organization_id").references(
    () => organizations.id,
    { onDelete: "set null" },
  ),
  status: trainingSessionStatusEnum("status").notNull().default("pending"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  finalScore: integer("final_score"),
  timeSpent: integer("time_spent"),
  environmentState: jsonb("environment_state"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const sessionEvents = pgTable("session_events", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => trainingSessions.id, { onDelete: "cascade" }),
  eventType: sessionEventTypeEnum("event_type").notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const mentorConversations = pgTable("mentor_conversations", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id")
    .notNull()
    .references(() => trainingSessions.id, { onDelete: "cascade" }),
  role: mentorMessageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const skillAssessments = pgTable("skill_assessments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  category: varchar("category", { length: 100 }).notNull(),
  skill: varchar("skill", { length: 100 }).notNull(),
  score: integer("score").notNull(),
  confidence: decimal("confidence", { precision: 3, scale: 2 }),
  assessedAt: timestamp("assessed_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const userCertifications = pgTable(
  "user_certifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    certificationId: varchar("certification_id", { length: 64 }).notNull(),
    earnedAt: timestamp("earned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userCertUnique: uniqueIndex("user_certifications_user_id_cert_id").on(
      t.userId,
      t.certificationId,
    ),
  }),
);

export const jobs = pgTable("jobs", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "no action" }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  requiredSkills: jsonb("required_skills").notNull(),
  location: varchar("location", { length: 255 }),
  salaryRange: varchar("salary_range", { length: 100 }),
  jobType: varchar("job_type", { length: 64 }),
  experienceLevel: varchar("experience_level", { length: 64 }),
  preferredCertifications: jsonb("preferred_certifications")
    .notNull()
    .default(sql`'[]'::jsonb`),
  published: boolean("published").notNull().default(true),
  status: jobStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const jobApplications = pgTable(
  "job_applications",
  {
    id: serial("id").primaryKey(),
    jobId: integer("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "no action" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "no action" }),
    matchScore: integer("match_score"),
    status: jobApplicationStatusEnum("status").notNull().default("applied"),
    appliedAt: timestamp("applied_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    jobUserUnique: uniqueIndex("job_applications_job_id_user_id_unique").on(t.jobId, t.userId),
  }),
);

export const slackIntegrations = pgTable("slack_integrations", {
  id: serial("id").primaryKey(),
  organizationId: integer("organization_id")
    .notNull()
    .unique()
    .references(() => organizations.id, { onDelete: "cascade" }),
  slackTeamId: varchar("slack_team_id", { length: 255 }).notNull(),
  slackTeamName: varchar("slack_team_name", { length: 255 }),
  /** AES-256-GCM ciphertext (base64) of the bot access token. */
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  channelId: varchar("channel_id", { length: 255 }),
  notificationSettings: jsonb("notification_settings")
    .notNull()
    .default(
      sql`'{"trainingStarted":true,"flagFound":true,"sessionCompleted":true,"weeklyDigest":true,"incidentSimulations":true}'::jsonb`,
    ),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/* -------------------------------------------------------------------------- */
/*                                  Relations                                 */
/* -------------------------------------------------------------------------- */

export const organizationsRelations = relations(
  organizations,
  ({ many, one }) => ({
    users: many(users),
    trainingSessions: many(trainingSessions),
    jobs: many(jobs),
    slackIntegration: one(slackIntegrations, {
      fields: [organizations.id],
      references: [slackIntegrations.organizationId],
    }),
  }),
);

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  accounts: many(accounts),
  authSessions: many(authSessions),
  trainingSessions: many(trainingSessions),
  skillAssessments: many(skillAssessments),
  certifications: many(userCertifications),
  jobApplications: many(jobApplications),
  scenariosCreated: many(scenarios),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, {
    fields: [authSessions.userId],
    references: [users.id],
  }),
}));

export const scenariosRelations = relations(scenarios, ({ one, many }) => ({
  creator: one(users, {
    fields: [scenarios.createdBy],
    references: [users.id],
  }),
  trainingSessions: many(trainingSessions),
}));

export const trainingSessionsRelations = relations(
  trainingSessions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [trainingSessions.userId],
      references: [users.id],
    }),
    scenario: one(scenarios, {
      fields: [trainingSessions.scenarioId],
      references: [scenarios.id],
    }),
    organization: one(organizations, {
      fields: [trainingSessions.organizationId],
      references: [organizations.id],
    }),
    events: many(sessionEvents),
    mentorMessages: many(mentorConversations),
  }),
);

export const sessionEventsRelations = relations(sessionEvents, ({ one }) => ({
  session: one(trainingSessions, {
    fields: [sessionEvents.sessionId],
    references: [trainingSessions.id],
  }),
}));

export const mentorConversationsRelations = relations(
  mentorConversations,
  ({ one }) => ({
    session: one(trainingSessions, {
      fields: [mentorConversations.sessionId],
      references: [trainingSessions.id],
    }),
  }),
);

export const skillAssessmentsRelations = relations(
  skillAssessments,
  ({ one }) => ({
    user: one(users, {
      fields: [skillAssessments.userId],
      references: [users.id],
    }),
  }),
);

export const userCertificationsRelations = relations(userCertifications, ({ one }) => ({
  user: one(users, {
    fields: [userCertifications.userId],
    references: [users.id],
  }),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [jobs.organizationId],
    references: [organizations.id],
  }),
  applications: many(jobApplications),
}));

export const jobApplicationsRelations = relations(
  jobApplications,
  ({ one }) => ({
    job: one(jobs, {
      fields: [jobApplications.jobId],
      references: [jobs.id],
    }),
    user: one(users, {
      fields: [jobApplications.userId],
      references: [users.id],
    }),
  }),
);

export const slackIntegrationsRelations = relations(
  slackIntegrations,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [slackIntegrations.organizationId],
      references: [organizations.id],
    }),
  }),
);

/* -------------------------------------------------------------------------- */
/*                                    Schema                                  */
/* -------------------------------------------------------------------------- */

export const schema = {
  organizations,
  stripeWebhookEvents,
  users,
  accounts,
  authSessions,
  verificationTokens,
  scenarios,
  trainingSessions,
  sessionEvents,
  mentorConversations,
  skillAssessments,
  userCertifications,
  jobs,
  jobApplications,
  slackIntegrations,
  organizationsRelations,
  usersRelations,
  accountsRelations,
  authSessionsRelations,
  scenariosRelations,
  trainingSessionsRelations,
  sessionEventsRelations,
  mentorConversationsRelations,
  skillAssessmentsRelations,
  userCertificationsRelations,
  jobsRelations,
  jobApplicationsRelations,
  slackIntegrationsRelations,
};
