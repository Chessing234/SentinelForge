ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripe_customer_id" varchar(255);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" varchar(255);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "billing_status" varchar(64);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "subscription_period_end" timestamp with time zone;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "suspended" boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "stripe_webhook_events" (
  "event_id" text PRIMARY KEY NOT NULL,
  "processed_at" timestamp with time zone NOT NULL DEFAULT now()
);
