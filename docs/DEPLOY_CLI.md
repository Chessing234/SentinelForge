# Deploy with CLI (full product)

GitHub Pages only hosts the static `docs/` site. The **real app** needs a container host.

## One command entrypoint

```bash
chmod +x scripts/deploy-cli.sh scripts/deploy-*.sh
./scripts/deploy-cli.sh help
```

| Command | What it does |
|---------|----------------|
| `./scripts/deploy-cli.sh docker` | Build + run production stack locally (Postgres, app, nginx) |
| `./scripts/deploy-cli.sh fly` | Create Fly app, Postgres, secrets, deploy |
| `./scripts/deploy-cli.sh render` | Validate `render.yaml` + print Dashboard steps |
| `./scripts/deploy-cli.sh all` | Render validate + Docker image build smoke test |

---

## Option A — Docker Compose (local or any VPS)

**Requires:** Docker Desktop or Colima running.

```bash
./scripts/deploy-cli.sh docker
# or if port 80 is busy:
HTTP_PORT=8088 ./scripts/deploy-cli.sh docker
```

Creates `.env.prod` from `.env.example` with generated secrets if missing.

- App: **http://localhost:8088/** (default port)
- Health: **http://localhost:8088/api/health**

Seed inside the stack:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec app npm run db:seed
docker compose -f docker-compose.prod.yml --env-file .env.prod exec app npm run db:seed:enhanced
```

---

## Option B — Render (CLI validate + Dashboard apply)

**Requires:** [Render CLI](https://render.com/docs/cli) (`brew install render`), GitHub repo pushed.

```bash
./scripts/deploy-cli.sh render
# or
render login
render blueprints validate render.yaml
```

Blueprint **cannot** be applied purely from CLI — connect repo in Dashboard:

1. **https://dashboard.render.com/blueprints** → **New Blueprint**
2. Connect `Chessing234/SentinelForge` (or your fork)
3. Apply `render.yaml` (web Docker service + free Postgres)
4. `AUTH_SECRET` and `DATABASE_URL` are auto-set; optional: add `GEMINI_API_KEY`

Re-deploy after code changes:

```bash
render services list -o json
render deploys create <SERVICE_ID> --wait
```

---

## Option C — Fly.io

**Requires:** [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/), `fly auth login`, machine quota.

```bash
./scripts/deploy-cli.sh fly
# custom name:
FLY_APP=sentinelforge-demo ./scripts/deploy-cli.sh fly
# external DB only:
SKIP_POSTGRES=1 DATABASE_URL='postgresql://...' ./scripts/deploy-cli.sh fly
```

Creates app `sentinelforge-<username>`, Fly Postgres cluster, sets `AUTH_SECRET`, runs `fly deploy`.

After deploy:

```bash
fly ssh console -a <app-name> -C 'npm run db:seed'
fly ssh console -a <app-name> -C 'npm run db:seed:enhanced'
```

Health: `https://<app-name>.fly.dev/api/health`

---

## Environment variables (all platforms)

**Required:** `DATABASE_URL`, `AUTH_SECRET`, public URL (`AUTH_URL`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`)

**Recommended:** `OPENAI_API_KEY` or `GEMINI_API_KEY` (OpenAI is used when both are set)

**Optional:** Stripe, Google/Slack OAuth, Slack bot — see `.env.example`

Render auto-maps `RENDER_EXTERNAL_URL` to auth URLs when those vars are unset.

---

## Not supported: Vercel

The app uses a custom Node server + Socket.IO. Use Docker hosts above, not Vercel serverless.
