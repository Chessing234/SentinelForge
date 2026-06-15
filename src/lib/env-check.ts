/**
 * Lightweight runtime environment validation.
 * Runs at server startup (not during build) to fail fast on misconfiguration
 * and to surface which optional integrations are disabled.
 */

type Issue = { key: string; message: string };

const REQUIRED_IN_PRODUCTION = ["DATABASE_URL", "AUTH_SECRET"] as const;

const STRIPE_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_ACADEMIC_MONTHLY",
  "STRIPE_PRICE_ACADEMIC_ANNUAL",
  "STRIPE_PRICE_ENTERPRISE_MONTHLY",
  "STRIPE_PRICE_ENTERPRISE_ANNUAL",
] as const;

function has(key: string): boolean {
  const value = process.env[key];
  return value !== undefined && value.trim() !== "";
}

/** Render sets RENDER_EXTERNAL_URL; map it to auth/public URLs if unset. */
function applyRenderUrlDefaults(): void {
  const base = process.env.RENDER_EXTERNAL_URL?.trim();
  if (!base) return;
  if (!has("NEXTAUTH_URL")) process.env.NEXTAUTH_URL = base;
  if (!has("AUTH_URL")) process.env.AUTH_URL = base;
  if (!has("NEXT_PUBLIC_APP_URL")) process.env.NEXT_PUBLIC_APP_URL = base;
}

export function checkEnv(): void {
  applyRenderUrlDefaults();
  const isProd = process.env.NODE_ENV === "production";
  const errors: Issue[] = [];
  const warnings: Issue[] = [];

  for (const key of REQUIRED_IN_PRODUCTION) {
    if (!has(key)) {
      errors.push({ key, message: `${key} is required.` });
    }
  }

  if (isProd && has("AUTH_SECRET") && (process.env.AUTH_SECRET ?? "").trim().length < 16) {
    errors.push({
      key: "AUTH_SECRET",
      message: "AUTH_SECRET is too short; use `openssl rand -base64 32`.",
    });
  }

  if (!has("NEXTAUTH_URL") && !has("AUTH_URL")) {
    warnings.push({
      key: "NEXTAUTH_URL",
      message:
        "Neither NEXTAUTH_URL nor AUTH_URL is set; absolute URLs/redirects default to http://localhost:3000.",
    });
  }

  const anyStripe = STRIPE_KEYS.some(has);
  const allStripe = STRIPE_KEYS.every(has);
  if (anyStripe && !allStripe) {
    warnings.push({
      key: "STRIPE_*",
      message:
        "Stripe is partially configured; checkout/portal will fail until all STRIPE_* vars are set.",
    });
  } else if (!anyStripe) {
    warnings.push({ key: "STRIPE_*", message: "Stripe not configured; billing is disabled." });
  }

  if (!has("GEMINI_API_KEY")) {
    warnings.push({
      key: "GEMINI_API_KEY",
      message: "GEMINI_API_KEY not set; AI mentor falls back to rule-based responses.",
    });
  }

  if (isProd && !has("SLACK_TOKEN_ENCRYPTION_KEY")) {
    warnings.push({
      key: "SLACK_TOKEN_ENCRYPTION_KEY",
      message:
        "SLACK_TOKEN_ENCRYPTION_KEY not set; stored Slack tokens use an insecure dev fallback key.",
    });
  }

  for (const w of warnings) {
    console.warn(`[env] warning: ${w.message}`);
  }

  if (errors.length > 0) {
    for (const e of errors) {
      console.error(`[env] error: ${e.message}`);
    }
    if (isProd) {
      throw new Error(
        `Environment validation failed: ${errors.map((e) => e.key).join(", ")}. See .env.example.`,
      );
    }
  }
}
