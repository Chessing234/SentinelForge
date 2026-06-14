ALTER TABLE "slack_integrations" ADD COLUMN IF NOT EXISTS "refresh_token" text;
ALTER TABLE "slack_integrations" ADD COLUMN IF NOT EXISTS "notification_settings" jsonb NOT NULL DEFAULT '{"trainingStarted":true,"flagFound":true,"sessionCompleted":true,"weeklyDigest":true,"incidentSimulations":true}'::jsonb;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "slack_notifications_enabled" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notify_email" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notify_browser" boolean DEFAULT true NOT NULL;
