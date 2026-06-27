#!/usr/bin/env bash
# Deploy SentinelForge to Fly.io (Docker image + optional Fly Postgres).
#
# Prerequisites:
#   fly auth login
#   fly orgs list
#
# Usage:
#   ./scripts/deploy-fly.sh
#   FLY_APP=sentinelforge-demo ./scripts/deploy-fly.sh
#   SKIP_POSTGRES=1 DATABASE_URL='postgresql://...' ./scripts/deploy-fly.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v fly >/dev/null 2>&1; then
  echo "Install Fly CLI: https://fly.io/docs/hands-on/install-flyctl/" >&2
  exit 1
fi

if ! fly auth whoami >/dev/null 2>&1; then
  echo "Not logged in. Run: fly auth login" >&2
  exit 1
fi

APP="${FLY_APP:-sentinelforge-$(whoami | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9-')}"
REGION="${FLY_REGION:-ord}"
PG_APP="${FLY_PG_APP:-${APP}-db}"

echo "==> Fly app: ${APP} (region ${REGION})"

if ! fly apps list --json 2>/dev/null | grep -q "\"name\":\"${APP}\""; then
  echo "==> Creating Fly app ${APP}"
  fly apps create "${APP}" --org personal
else
  echo "==> Fly app ${APP} already exists"
fi

# Patch fly.toml app name for this deploy
if grep -q 'app = "sentinelforge-replace-me"' fly.toml 2>/dev/null; then
  sed -i.bak "s/app = \"sentinelforge-replace-me\"/app = \"${APP}\"/" fly.toml
  rm -f fly.toml.bak
fi

if [[ "${SKIP_POSTGRES:-0}" != "1" ]]; then
  if ! fly postgres list --json 2>/dev/null | grep -q "\"name\":\"${PG_APP}\""; then
    echo "==> Creating Fly Postgres cluster ${PG_APP} (this may take a few minutes)"
    fly postgres create \
      --name "${PG_APP}" \
      --region "${REGION}" \
      --initial-cluster-size 1 \
      --vm-size shared-cpu-1x \
      --volume-size 1 \
      --org personal
  else
    echo "==> Postgres ${PG_APP} already exists"
  fi

  echo "==> Attaching Postgres to ${APP}"
  fly postgres attach "${PG_APP}" -a "${APP}" || true
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "==> Reading DATABASE_URL from Fly secrets"
  DATABASE_URL="$(fly secrets list -a "${APP}" 2>/dev/null | awk '/DATABASE_URL/ { print "set" }' || true)"
  if [[ -z "${DATABASE_URL}" ]] && [[ "${SKIP_POSTGRES:-0}" == "1" ]]; then
    echo "Set DATABASE_URL or create Postgres with SKIP_POSTGRES=0." >&2
    exit 1
  fi
fi

if ! fly secrets list -a "${APP}" 2>/dev/null | grep -q "AUTH_SECRET"; then
  echo "==> Setting AUTH_SECRET"
  fly secrets set -a "${APP}" "AUTH_SECRET=$(openssl rand -base64 32)"
fi

echo "==> Deploying ${APP}"
fly deploy -a "${APP}" --remote-only

APP_URL="https://${APP}.fly.dev"
echo ""
echo "Deployed: ${APP_URL}"
echo "Health:   ${APP_URL}/api/health"
echo ""
echo "Seed the database (one-off):"
echo "  fly ssh console -a ${APP} -C 'npm run db:seed'"
echo "  fly ssh console -a ${APP} -C 'npm run db:seed:enhanced'"
