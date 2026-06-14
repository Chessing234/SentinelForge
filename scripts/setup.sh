#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Checking Node.js (>= 20)"
node -v | awk -F. '{ if ($1+0 < 20) { print "Node 20+ required"; exit 1 } }'

echo "==> Installing dependencies"
npm ci

if [[ ! -f .env ]]; then
  echo "==> Creating .env from .env.example"
  cp .env.example .env
  echo "    Edit .env with your secrets before production use."
fi

if command -v docker >/dev/null 2>&1; then
  echo "==> Starting Docker services (Postgres + Redis) if compose file exists"
  if [[ -f docker-compose.yml ]]; then
    docker compose up -d || true
  fi
else
  echo "    (Docker not found — start Postgres manually and set DATABASE_URL)"
fi

echo "==> Running database migrations"
npm run db:migrate

echo "==> Seeding database (base + enhanced demo)"
npm run db:seed || true
npm run db:seed:enhanced || true

echo ""
echo "✅ Setup complete."
echo "   Dev server:  npm run dev"
echo "   Open:       http://localhost:3000"
echo "   Demo admin: admin@sentinelforge.com (password from seed: base seed uses password123; enhanced uses demo123 for new demo users — check README)"
