#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-memory}"

cd "${ROOT_DIR}"

if [[ -f ".env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

export STATIC_ROOT="${STATIC_ROOT:-${ROOT_DIR}}"

case "${MODE}" in
  memory)
    export STORE_REPOSITORY_BACKEND="${STORE_REPOSITORY_BACKEND:-memory}"
    export STORE_RUNTIME_BACKEND="${STORE_RUNTIME_BACKEND:-memory}"
    ;;
  stateful)
    docker compose up -d postgres redis
    export STORE_REPOSITORY_BACKEND="${STORE_REPOSITORY_BACKEND:-postgres}"
    export STORE_RUNTIME_BACKEND="${STORE_RUNTIME_BACKEND:-redis}"
    export POSTGRES_DSN="${POSTGRES_DSN:-postgres://taas:taas@localhost:5432/taas?sslmode=disable}"
    export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
    ;;
  supabase)
    export STORE_REPOSITORY_BACKEND="${STORE_REPOSITORY_BACKEND:-postgres}"
    export STORE_RUNTIME_BACKEND="${STORE_RUNTIME_BACKEND:-memory}"
    export POSTGRES_DSN="${POSTGRES_DSN:-}"
    if [[ -z "${POSTGRES_DSN}" ]]; then
      printf 'supabase mode requires POSTGRES_DSN\n' >&2
      exit 1
    fi
    ;;
  *)
    printf 'usage: %s [memory|stateful|supabase]\n' "${BASH_SOURCE[0]##*/}" >&2
    exit 1
    ;;
esac

exec go run ./cmd/control-api
