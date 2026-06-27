#!/usr/bin/env bash
# Deploy SentinelForge locally with Docker Compose (production stack).
# Usage:
#   ./scripts/deploy-docker.sh
#   HTTP_PORT=8088 ./scripts/deploy-docker.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

export PATH="${PATH}:/Applications/Docker.app/Contents/Resources/bin"

if ! command -v docker >/dev/null 2>&1; then
  echo "Install Docker Desktop or Colima first." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running." >&2
  echo "  macOS: open Docker Desktop, or run: colima start" >&2
  exit 1
fi

if [[ ! -f .env.prod ]]; then
  echo "Creating .env.prod from .env.example with generated secrets..."
  cp .env.example .env.prod
  AUTH_SECRET="$(openssl rand -base64 32)"
  POSTGRES_PASSWORD="$(openssl rand -hex 16)"
  SLACK_KEY="$(openssl rand -base64 32)"
  {
    echo ""
    echo "POSTGRES_USER=postgres"
    echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
    echo "POSTGRES_DB=sentinelforge"
    echo "AUTH_SECRET=${AUTH_SECRET}"
    echo "AUTH_URL=http://localhost:8088"
    echo "NEXTAUTH_URL=http://localhost:8088"
    echo "NEXT_PUBLIC_APP_URL=http://localhost:8088"
    echo "SLACK_TOKEN_ENCRYPTION_KEY=${SLACK_KEY}"
  } >> .env.prod
  echo "Edit .env.prod to add GEMINI_API_KEY and other optional integrations."
fi

export HTTP_PORT="${HTTP_PORT:-8088}"
export HTTPS_PORT="${HTTPS_PORT:-8443}"
exec "$ROOT/scripts/deploy-prod-compose.sh"
