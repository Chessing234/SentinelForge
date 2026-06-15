# Next steps (checklist)

Use this after clone or when turning the project into something you rely on.

## 1. Keep ~10 GB free on your Mac disk

Docker / Colima needs space for images and layers. If the disk is full, builds fail with **I/O errors** or **checksum mismatch** on Colima’s cached VM image. Free space, then:

```bash
rm -rf ~/Library/Caches/colima/caches/*
colima start
```

## 2. Run the full stack locally (Docker)

```bash
colima start   # or Docker Desktop
cp .env.example .env.prod
# Edit .env.prod — set AUTH_SECRET, POSTGRES_PASSWORD, and URLs to match how you browse (e.g. http://localhost:8088)

HTTP_PORT=8088 HTTPS_PORT=8443 ./scripts/deploy-prod-compose.sh
```

- App (through nginx): **http://localhost:8088/**
- Health: **http://localhost:8088/api/health**

## 3. Load demo data (optional)

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec app npm run db:seed
docker compose -f docker-compose.prod.yml --env-file .env.prod exec app npm run db:seed:enhanced
```

See the base seed output for default passwords; enhanced adds `demo123` for many demo users.

## 4. Public static site (GitHub Pages)

Already wired: push to `main` and ensure **Settings → Pages → GitHub Actions**. URL: `https://<you>.github.io/<repo>/`.

## 5. Hosted app in the cloud (no Docker on your laptop)

- **Render:** Dashboard → **New → Blueprint** → use repo `render.yaml`. Validate locally: `render blueprints validate render.yaml`.
- **Fly.io:** Fix **machine quota**, edit `fly.toml` app name, `fly deploy` + secrets.

Details: [DEPLOY_CLI.md](./DEPLOY_CLI.md).

## 6. Production hardening

- Custom domain + HTTPS (nginx TLS block in `deploy/nginx.conf` or your host’s certs).
- Stripe / OAuth / Gemini env vars only if you use those features.
- Postgres backups for the `pgdata` volume (or managed DB snapshots).
