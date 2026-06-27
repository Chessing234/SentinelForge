#!/usr/bin/env bash
# Validate and guide Render deployment via CLI + Dashboard Blueprint.
#
# Render Blueprints are applied from the Dashboard (Git-connected repo).
# This script validates render.yaml, checks auth, and prints next steps.
#
# Usage:
#   ./scripts/deploy-render.sh
#   RENDER_API_KEY=rnd_... ./scripts/deploy-render.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if ! command -v render >/dev/null 2>&1; then
  echo "Install Render CLI: brew install render" >&2
  exit 1
fi

echo "==> Validating render.yaml"
render blueprints validate render.yaml

if [[ -n "${RENDER_API_KEY:-}" ]]; then
  export RENDER_API_KEY
  echo "==> Render API key detected"
elif render whoami -o json >/dev/null 2>&1; then
  echo "==> Render CLI authenticated: $(render whoami 2>/dev/null || true)"
else
  echo "==> Not logged in to Render. Run one of:"
  echo "    render login"
  echo "    export RENDER_API_KEY=rnd_...   # from https://dashboard.render.com/u/settings#api-keys"
fi

REMOTE="$(git remote get-url origin 2>/dev/null || echo "")"
if [[ -n "${REMOTE}" ]]; then
  echo "==> Git remote: ${REMOTE}"
else
  echo "==> Warning: no git remote 'origin'. Push render.yaml before applying Blueprint."
fi

echo ""
echo "Render deploy steps (CLI + Dashboard):"
echo "  1. Push code:     git push origin main"
echo "  2. Dashboard:     https://dashboard.render.com/blueprints"
echo "                    → New Blueprint → connect repo → Apply render.yaml"
echo "  3. After first deploy, seed DB:"
echo "                    render ssh sentinelforge   # or use Dashboard shell"
echo "                    npm run db:seed && npm run db:seed:enhanced"
echo ""
echo "Re-deploy an existing service (after Blueprint is applied):"
echo "  render services list -o json"
echo "  render deploys create <SERVICE_ID> --wait"
echo ""
echo "Health check: GET https://<your-service>.onrender.com/api/health"
