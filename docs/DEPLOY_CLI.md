# Deploy with CLI (full product)

GitHub Pages only hosts the static `docs/` site. The **real app** needs a container host.

## Option A — Docker Compose (works today)

Requires Docker + Compose.

```bash
cp .env.example .env.prod
# Edit .env.prod: AUTH_SECRET, POSTGRES_PASSWORD, URLs, optional Stripe/Gemini

chmod +x scripts/deploy-prod-compose.sh
./scripts/deploy-prod-compose.sh
```

If **port 80** is already taken:

```bash
HTTP_PORT=8088 HTTPS_PORT=8443 ./scripts/deploy-prod-compose.sh
```

## Option B — Render (CLI validate + dashboard apply)

1. Validate the blueprint:

   ```bash
   render blueprints validate render.yaml
   ```

2. In the [Render Dashboard](https://dashboard.render.com): **New → Blueprint** → connect `Chessing234/SentinelForge` → apply `render.yaml`.

3. Wait for the web service to go live. The app reads **`RENDER_EXTERNAL_URL`** automatically for auth/public URLs.

> Blueprint uses **free** plans for the web (Docker) and Postgres. If Render requires a card for your workspace, add billing once in the dashboard, then apply the blueprint again.

Validate locally:

```bash
render blueprints validate render.yaml
```

## Option C — Fly.io

Your Fly org must have **available machine quota**. Then:

```bash
# Edit fly.toml: set app = "unique-name"
fly launch --copy-config   # or fly deploy
fly secrets set AUTH_SECRET="$(openssl rand -base64 32)" DATABASE_URL="postgresql://..."
fly deploy
```

If `fly launch` errors with **organization machine limit**, remove unused Fly apps or add capacity in the Fly dashboard.

## Option D — GitHub Actions → Fly (optional)

Add repository secrets `FLY_API_TOKEN` and `FLY_APP_NAME`, then extend `.github/workflows/` with a deploy job (not included by default).
