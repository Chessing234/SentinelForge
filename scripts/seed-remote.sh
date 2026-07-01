#!/usr/bin/env bash
# Seed production DB without SSH (Render free tier friendly).
#
# Option A — remote HTTP (recommended on Render):
#   1. Set SEED_SECRET in Render env + redeploy
#   2. SEED_SECRET=your-secret ./scripts/seed-remote.sh
#
# Option B — local against external DATABASE_URL:
#   DATABASE_URL='postgresql://...' ./scripts/seed-remote.sh --local
#
# Option C — curl manually:
#   curl -X POST "$APP_URL/api/admin/seed" \
#     -H "x-seed-secret: $SEED_SECRET" \
#     -H "Content-Type: application/json" \
#     -d '{"enhanced":true}'
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

APP_URL="${APP_URL:-https://sentinelforge.onrender.com}"
MODE="${1:-remote}"

run_local() {
  if [[ -z "${DATABASE_URL:-}" ]]; then
    echo "Set DATABASE_URL (external connection string from Render Postgres dashboard)." >&2
    exit 1
  fi
  echo "==> Seeding via local npm (DATABASE_URL set)"
  npm run db:seed
  npm run db:seed:enhanced
  echo "==> Done"
}

run_remote() {
  if [[ -z "${SEED_SECRET:-}" ]]; then
    echo "Set SEED_SECRET (must match Render env var)." >&2
    echo ""
    echo "Steps:"
    echo "  1. Render Dashboard → sentinelforge → Environment"
    echo "     Add SEED_SECRET=$(openssl rand -hex 16)"
    echo "  2. Wait for redeploy, then:"
    echo "     SEED_SECRET=... ./scripts/seed-remote.sh"
    echo ""
    echo "Or seed locally with external DB URL:"
    echo "  DATABASE_URL='postgresql://...' ./scripts/seed-remote.sh --local"
    exit 1
  fi

  echo "==> POST ${APP_URL}/api/admin/seed"
  curl -sf -X POST "${APP_URL}/api/admin/seed" \
    -H "x-seed-secret: ${SEED_SECRET}" \
    -H "Content-Type: application/json" \
    -d '{"enhanced":true}' \
    | python3 -m json.tool 2>/dev/null || cat
  echo ""
  echo "Demo login: ${APP_URL}/login"
  echo "  student1@state.edu / password123"
}

case "${MODE}" in
  --local|local) run_local ;;
  --remote|remote|"") run_remote ;;
  -h|--help|help)
    sed -n '2,16p' "$0" | sed 's/^# \?//'
    ;;
  *)
    echo "Usage: ./scripts/seed-remote.sh [--local|--remote]" >&2
    exit 1
    ;;
esac
