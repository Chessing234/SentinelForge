#!/usr/bin/env bash
# Render deployment via CLI (no Dashboard required after initial Blueprint setup).
#
# Usage:
#   ./scripts/deploy-render.sh              # validate + status
#   ./scripts/deploy-render.sh deploy       # trigger deploy and wait
#   ./scripts/deploy-render.sh seed         # one-off job: db:seed + enhanced
#   ./scripts/deploy-render.sh logs         # tail recent logs
#   ./scripts/deploy-render.sh health       # curl /api/health
#   ./scripts/deploy-render.sh all          # deploy + seed + health
#
# Env:
#   RENDER_SERVICE_ID=srv-...   (default: sentinelforge service)
#   RENDER_SERVICE_NAME=...     (default: sentinelforge)
#   RENDER_APP_URL=...          (default: https://sentinelforge.onrender.com)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

SERVICE_ID="${RENDER_SERVICE_ID:-srv-d8nuatmgvqtc73e55igg}"
SERVICE_NAME="${RENDER_SERVICE_NAME:-sentinelforge}"
APP_URL="${RENDER_APP_URL:-https://sentinelforge.onrender.com}"
CMD="${1:-status}"

require_render() {
  if ! command -v render >/dev/null 2>&1; then
    echo "Install Render CLI: brew install render && render login" >&2
    exit 1
  fi
  if ! render whoami >/dev/null 2>&1; then
    echo "Run: render login" >&2
    exit 1
  fi
}

cmd_status() {
  echo "==> Render CLI: $(render whoami 2>/dev/null | head -1)"
  echo "==> Validating render.yaml"
  render blueprints validate render.yaml
  echo ""
  echo "==> Service: ${SERVICE_NAME} (${SERVICE_ID})"
  echo "==> URL: ${APP_URL}"
  render services list -o text 2>/dev/null | grep -i sentinel || true
  echo ""
  render deploys list "${SERVICE_ID}" -o text 2>/dev/null | head -4 || true
  echo ""
  echo "Set secrets in Dashboard (no CLI env API yet):"
  echo "  OPENAI_API_KEY=sk-...   # AI mentor"
  echo "  https://dashboard.render.com/web/${SERVICE_ID}/env"
}

cmd_deploy() {
  echo "==> Deploying ${SERVICE_NAME} (${SERVICE_ID})"
  render deploys create "${SERVICE_ID}" --wait --confirm -o text
  echo "==> Deploy finished"
}

cmd_seed() {
  echo "==> Running db:seed via Render one-off job"
  if render jobs create "${SERVICE_ID}" \
    --start-command "npm run db:seed" \
    --confirm -o text 2>/dev/null; then
    echo "==> Running db:seed:enhanced"
    render jobs create "${SERVICE_ID}" \
      --start-command "npm run db:seed:enhanced" \
      --confirm -o text 2>/dev/null || true
    echo "==> Seed jobs submitted. Watch: render jobs list ${SERVICE_ID}"
    return 0
  fi
  echo ""
  echo "One-off jobs require a paid Render plan on free tiers."
  echo "Seed manually via SSH (interactive):"
  echo "  render ssh ${SERVICE_ID}"
  echo "  npm run db:seed && npm run db:seed:enhanced"
  return 1
}

cmd_logs() {
  render logs "${SERVICE_ID}" --tail --confirm 2>/dev/null || render logs "${SERVICE_ID}" --confirm
}

cmd_health() {
  echo "==> GET ${APP_URL}/api/health"
  local tries=3 code body
  for i in $(seq 1 "$tries"); do
    code="$(curl -s -o /tmp/sf-health.json -w "%{http_code}" -m 90 "${APP_URL}/api/health" || echo "000")"
    body="$(cat /tmp/sf-health.json 2>/dev/null || echo timeout)"
    echo "Attempt ${i}: HTTP ${code} — ${body}"
    if [[ "${code}" == "200" ]]; then
      return 0
    fi
    [[ "${i}" -lt "${tries}" ]] && echo "Retrying (cold start)..." && sleep 15
  done
  return 1
}

cmd_all() {
  cmd_deploy
  cmd_seed || true
  cmd_health || echo "Health check failed — service may still be warming up."
  echo ""
  echo "Demo login: ${APP_URL}/login"
  echo "  student1@state.edu / password123"
}

require_render

case "${CMD}" in
  status|"") cmd_status ;;
  deploy) cmd_deploy ;;
  seed) cmd_seed ;;
  logs) cmd_logs ;;
  health) cmd_health ;;
  all) cmd_all ;;
  -h|--help|help)
    sed -n '2,12p' "$0" | sed 's/^# \?//'
    ;;
  *)
    echo "Unknown command: ${CMD} (try: deploy | seed | logs | health | all)" >&2
    exit 1
    ;;
esac
