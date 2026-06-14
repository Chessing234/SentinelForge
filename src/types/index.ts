import type { InferInsertModel, InferSelectModel } from "drizzle-orm";

import {
  jobApplicationStatusEnum,
  jobStatusEnum,
  jobs,
  jobApplications,
  mentorConversations,
  mentorMessageRoleEnum,
  organizationPlanEnum,
  organizations,
  scenarioCategoryEnum,
  scenarioDifficultyEnum,
  scenarios,
  sessionEvents,
  sessionEventTypeEnum,
  skillAssessments,
  slackIntegrations,
  trainingSessionStatusEnum,
  trainingSessions,
  userCertifications,
  userRoleEnum,
  users,
} from "@/db/schema";

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Organization = InferSelectModel<typeof organizations>;
export type NewOrganization = InferInsertModel<typeof organizations>;

export type Scenario = InferSelectModel<typeof scenarios>;
export type NewScenario = InferInsertModel<typeof scenarios>;

export type TrainingSession = InferSelectModel<typeof trainingSessions>;
export type NewTrainingSession = InferInsertModel<typeof trainingSessions>;

export type SessionEvent = InferSelectModel<typeof sessionEvents>;
export type NewSessionEvent = InferInsertModel<typeof sessionEvents>;

export type MentorConversation = InferSelectModel<typeof mentorConversations>;
export type NewMentorConversation = InferInsertModel<typeof mentorConversations>;

export type SkillAssessment = InferSelectModel<typeof skillAssessments>;
export type NewSkillAssessment = InferInsertModel<typeof skillAssessments>;

export type UserCertification = InferSelectModel<typeof userCertifications>;
export type NewUserCertification = InferInsertModel<typeof userCertifications>;

export type Job = InferSelectModel<typeof jobs>;
export type NewJob = InferInsertModel<typeof jobs>;

export type JobApplication = InferSelectModel<typeof jobApplications>;
export type NewJobApplication = InferInsertModel<typeof jobApplications>;

export type SlackIntegration = InferSelectModel<typeof slackIntegrations>;
export type NewSlackIntegration = InferInsertModel<typeof slackIntegrations>;

export type Role = (typeof userRoleEnum.enumValues)[number];
export type OrganizationPlan = (typeof organizationPlanEnum.enumValues)[number];
export type Difficulty = (typeof scenarioDifficultyEnum.enumValues)[number];
export type Category = (typeof scenarioCategoryEnum.enumValues)[number];
export type SessionStatus = (typeof trainingSessionStatusEnum.enumValues)[number];
export type EventType = (typeof sessionEventTypeEnum.enumValues)[number];
export type MentorRole = (typeof mentorMessageRoleEnum.enumValues)[number];
export type JobPostingStatus = (typeof jobStatusEnum.enumValues)[number];
export type ApplicationStatus =
  (typeof jobApplicationStatusEnum.enumValues)[number];

export const UserRoles = {
  STUDENT: "student",
  INSTRUCTOR: "instructor",
  ADMIN: "admin",
  ENTERPRISE_ADMIN: "enterprise_admin",
} as const;

export const OrganizationPlans = {
  FREE: "free",
  ACADEMIC: "academic",
  ENTERPRISE: "enterprise",
} as const;

export const ScenarioDifficulties = {
  BEGINNER: "beginner",
  INTERMEDIATE: "intermediate",
  ADVANCED: "advanced",
  EXPERT: "expert",
} as const;

export const ScenarioCategories = {
  NETWORK_SECURITY: "network_security",
  WEB_SECURITY: "web_security",
  CLOUD_SECURITY: "cloud_security",
  INCIDENT_RESPONSE: "incident_response",
  MALWARE_ANALYSIS: "malware_analysis",
  FORENSICS: "forensics",
} as const;

export const SessionStatuses = {
  PENDING: "pending",
  RUNNING: "running",
  PAUSED: "paused",
  COMPLETED: "completed",
  ABANDONED: "abandoned",
} as const;

export const SessionEventTypes = {
  ENVIRONMENT_READY: "environment_ready",
  ATTACK_STARTED: "attack_started",
  ATTACK_DETECTED: "attack_detected",
  HINT_REQUESTED: "hint_requested",
  HINT_GIVEN: "hint_given",
  FLAG_SUBMITTED: "flag_submitted",
  FLAG_CORRECT: "flag_correct",
  FLAG_INCORRECT: "flag_incorrect",
  SESSION_COMPLETED: "session_completed",
  MILESTONE_REACHED: "milestone_reached",
} as const;

export const MentorRoles = {
  USER: "user",
  MENTOR: "mentor",
  SYSTEM: "system",
} as const;

export const JobStatuses = {
  OPEN: "open",
  CLOSED: "closed",
  FILLED: "filled",
} as const;

export const ApplicationStatuses = {
  APPLIED: "applied",
  REVIEWING: "reviewing",
  INTERVIEW: "interview",
  OFFERED: "offered",
  REJECTED: "rejected",
  ACCEPTED: "accepted",
  WITHDRAWN: "withdrawn",
} as const;
