-- User job-seeking profile
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_bio" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_location" varchar(255);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_public" boolean NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "linkedin_url" varchar(500);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "portfolio_url" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "resume_url" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "job_search_experience_level" varchar(64);

-- Job posting extensions
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "job_type" varchar(64);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "experience_level" varchar(64);
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "preferred_certifications" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "published" boolean NOT NULL DEFAULT true;
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now();

-- One application per user per job
CREATE UNIQUE INDEX IF NOT EXISTS "job_applications_job_id_user_id_unique" ON "job_applications" ("job_id", "user_id");

DO $$ BEGIN
  ALTER TYPE "job_application_status" ADD VALUE IF NOT EXISTS 'withdrawn';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
