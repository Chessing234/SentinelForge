#!/usr/bin/env bash
# SentinelForge deployment entrypoint.
# Usage: ./scripts/deploy-cli.sh [docker|fly|render|all]
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGET="${1:-}"

usage() {
  cat <<'EOF'
SentinelForge deploy CLI

  ./scripts/deploy-cli.sh docker   Local/production Docker Compose stack
  ./scripts/deploy-cli.sh fly      Fly.io (Docker + Postgres)
  ./scripts/deploy-cli.sh render [status|deploy|seed|logs|health|all]
  ./scripts/deploy-cli.sh all      Run render validate + docker build smoke test

Examples:
  HTTP_PORT=8088 ./scripts/deploy-cli.sh docker
  FLY_APP=my-sentinel ./scripts/deploy-cli.sh fly
  ./scripts/deploy-cli.sh render all
EOF
}

run_docker() {
  chmod +x "$ROOT/scripts/deploy-docker.sh"
  "$ROOT/scripts/deploy-docker.sh"
}

run_fly() {
  chmod +x "$ROOT/scripts/deploy-fly.sh"
  "$ROOT/scripts/deploy-fly.sh"
}

run_render() {
  chmod +x "$ROOT/scripts/deploy-render.sh"
  "$ROOT/scripts/deploy-render.sh" "${2:-status}"
}

run_all() {
  run_render
  echo ""
  echo "==> Docker image build smoke test"
  export PATH="${PATH}:/Applications/Docker.app/Contents/Resources/bin"
  if docker info >/dev/null 2>&1; then
    docker build -t sentinelforge:local .
    echo "Docker build OK (tag: sentinelforge:local)"
  else
    echo "Docker daemon not running — skipped image build. Start Docker and run: ./scripts/deploy-cli.sh docker"
  fi
}

case "${TARGET}" in
  docker) run_docker ;;
  fly) run_fly ;;
  render) run_render "$@" ;;
  all) run_all ;;
  -h|--help|help|"")
    usage
    [[ -z "${TARGET}" ]] && exit 0 || exit 0
    ;;
  *)
    echo "Unknown target: ${TARGET}" >&2
    usage
    exit 1
    ;;
esac
