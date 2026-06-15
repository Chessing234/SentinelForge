# SentinelForge

SentinelForge is a cyber training and workforce platform built with **Next.js 15** (App Router), **NextAuth**, **Drizzle ORM**, and **PostgreSQL**. It includes hands-on training sessions (with Socket.IO), job placement, Slack integrations, **Stripe billing** for organizations, and an **enterprise admin** dashboard.

## Public site (GitHub Pages)

A **static** landing page lives in **`docs/`** and deploys via **GitHub Actions** to **`https://<owner>.github.io/<repo>/`** when you enable Pages with source **GitHub Actions**. This is only marketing copy — the full app still needs Docker/your own host. Setup steps: [docs/GITHUB_PAGES.md](docs/GITHUB_PAGES.md).

## Deploy the full app (CLI)

See **[docs/DEPLOY_CLI.md](docs/DEPLOY_CLI.md)** — Docker Compose on your machine, **Render** blueprint (`render.yaml` + `render blueprints validate`), or **Fly.io** when your org has machine quota.

**Ordered checklist:** [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md).

## Prerequisites

- **Node.js** 18.18+ (20+ recommended for local development)
- **PostgreSQL** 14+
- Optional: **Stripe** account (checkout, customer portal, webhooks)
- Optional: **Google** / **Slack** OAuth apps for sign-in
- Optional: **Google Gemini** API key for AI mentor features

## Quick start

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL and AUTH_SECRET at minimum

npm install
npm run db:migrate
npm run db:seed
# Optional richer demo data (~orgs, users, sessions, jobs):
npm run db:seed:enhanced

npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The dev server runs **`server.ts`**, which starts Next.js and the **Socket.IO** training server together.

### First login

After `db:seed`, use the credentials printed by the seed script (or create a user via **Register** if enabled).

## Environment variables

Copy **`.env.example`** to **`.env`**. Highlights:

| Area | Variables |
|------|-----------|
| Database | `DATABASE_URL` |
| Auth | `AUTH_SECRET`, `AUTH_URL` or `NEXTAUTH_URL` |
| OAuth | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`; `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` (user sign-in) |
| Gemini | `GEMINI_API_KEY`, optional `GEMINI_MODEL` |
| Slack app (bot, events, slash commands) | `SLACK_BOT_CLIENT_ID`, `SLACK_BOT_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `SLACK_TOKEN_ENCRYPTION_KEY` |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*` (see below) |
| App / sockets | `NEXT_PUBLIC_APP_URL` |

### Stripe billing

1. Create **Products** and **Prices** in Stripe for academic and enterprise plans (monthly and annual).
2. Set price IDs in `.env`:

   - `STRIPE_PRICE_ACADEMIC_MONTHLY`
   - `STRIPE_PRICE_ACADEMIC_ANNUAL`
   - `STRIPE_PRICE_ENTERPRISE_MONTHLY`
   - `STRIPE_PRICE_ENTERPRISE_ANNUAL`

3. Add webhook endpoint: **`/api/billing/webhook`** (full URL: `{NEXTAUTH_URL}/api/billing/webhook`).
4. Subscribe to events you handle in code (e.g. `checkout.session.completed`, subscription lifecycle events).
5. Set `STRIPE_WEBHOOK_SECRET` from the webhook signing secret.

Checkout and portal routes require Stripe keys; the webhook route is **public** (signature-verified) and is excluded from session middleware where configured.

### Slack

- **User login** via Slack uses `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` (NextAuth provider).
- **Workspace bot** flows use `SLACK_BOT_*` and `SLACK_SIGNING_SECRET` as in `.env.example`.

Use a strong **`SLACK_TOKEN_ENCRYPTION_KEY`** in production (do not rely on the dev fallback).

## npm scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev: Next + Socket.IO |
| `npm run build` | Production Next.js build |
| `npm run start` | Production: `server.ts` |
| `npm run lint` | ESLint |
| `npm run db:generate` | Drizzle migrations (generate) |
| `npm run db:migrate` | Apply migrations |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:seed` | Base seed |
| `npm run db:seed:enhanced` | Extended demo data |

## Docker

- **`docker-compose.yml`** — local Postgres + Redis for development-style runs.
- **`docker-compose.prod.yml`** — full production stack: Postgres, Redis, the app, and an nginx reverse proxy (mounts **`./deploy/nginx.conf`**).

### Run the production stack

```bash
cp .env.example .env.prod   # then fill secrets + your domain
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

On boot the app container runs **`scripts/docker-entrypoint.sh`**, which applies DB **migrations** and then `exec`s the server (so `SIGTERM` reaches Node for **graceful shutdown**). The container exposes a health check at **`/api/health`**; nginx waits for the app to be healthy before starting.

Build the app image with the root **`Dockerfile`**. Production **`DATABASE_URL`** and secrets are injected at runtime via `--env-file` (never baked into the image).

### Ports & TLS

- The nginx host ports are configurable: `HTTP_PORT` (default `80`) and `HTTPS_PORT` (default `443`). Example to avoid a conflict: `HTTP_PORT=8088 docker compose -f docker-compose.prod.yml --env-file .env.prod up -d`.
- For HTTPS, mount certs into the nginx container and uncomment the TLS server block in **`deploy/nginx.conf`** (instructions are inline in that file).

### Seeding inside the stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec app npm run db:seed
docker compose -f docker-compose.prod.yml --env-file .env.prod exec app npm run db:seed:enhanced
```

## Continuous integration

**`.github/workflows/ci.yml`** runs on push/PR: `npm ci`, lint, `tsc --noEmit`, `next build`, and a Docker image build (no push).

## Health & operations

- **`GET /api/health`** → `{ "status": "ok", "database": "up" | "down" }` (public, not rate-limited).
- The server validates required env at startup (**`src/lib/env-check.ts`**) and fails fast in production if `DATABASE_URL` / `AUTH_SECRET` are missing.
- Graceful shutdown closes Socket.IO, the HTTP server, and the Postgres pool on `SIGTERM`/`SIGINT`.

> Note: this app uses a custom Node server (`server.ts`) for Socket.IO, so it is **not** deployable to serverless-only targets (e.g. Vercel functions). Use a container/VM host.

## Project layout (abbreviated)

- `src/app` — App Router pages, API routes, `error.tsx` / `loading.tsx`, metadata routes
- `src/components` — UI, billing, admin, training, layout
- `src/db` — Drizzle schema, queries, seeds, migrations under `drizzle/`
- `src/lib` — Billing (Stripe), Slack, agents, logger, rate limiter, metrics
- `src/middleware.ts` — Security headers, rate limits, billing route RBAC, public webhook
- `deploy/nginx.conf` — Sample nginx reverse proxy
- `scripts/setup.sh` — Optional environment setup helper

## License

Private / unlicensed unless otherwise specified by the repository owner.
