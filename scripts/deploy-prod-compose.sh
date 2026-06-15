#!/usr/bin/env bash
# Deploy the full stack locally or on any host with Docker (same as production compose).
# Usage:
#   cp .env.example .env.prod   # then edit secrets
#   ./scripts/deploy-prod-compose.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required." >&2
  exit 1
fi

if [[ ! -f .env.prod ]]; then
  echo "Missing .env.prod — copy from .env.example and set AUTH_SECRET, POSTGRES_PASSWORD, etc." >&2
  exit 1
fi

export PATH="${PATH}:/Applications/Docker.app/Contents/Resources/bin"
if docker compose version >/dev/null 2>&1; then
  DC=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  DC=(docker-compose)
else
  echo "Install Docker Compose v2 (docker compose) or v1 (docker-compose)." >&2
  exit 1
fi

echo "==> Building and starting (docker-compose.prod.yml)"
export HTTP_PORT="${HTTP_PORT:-80}"
export HTTPS_PORT="${HTTPS_PORT:-443}"
"${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod up -d --build

echo "==> Status"
"${DC[@]}" -f docker-compose.prod.yml --env-file .env.prod ps

HTTP_PORT="${HTTP_PORT:-80}"
echo ""
echo "Using HTTP_PORT=${HTTP_PORT} (set HTTP_PORT=8088 if port 80 is busy)."
echo "App (via nginx): http://localhost:${HTTP_PORT}/"
echo "Health:          http://localhost:${HTTP_PORT}/api/health"
