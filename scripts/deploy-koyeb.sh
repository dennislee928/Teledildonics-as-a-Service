#!/usr/bin/env bash
set -euo pipefail

INPUT_KOYEB_APP_NAME="${KOYEB_APP_NAME:-}"
INPUT_KOYEB_SERVICE_NAME="${KOYEB_SERVICE_NAME:-}"
INPUT_KOYEB_GIT_BRANCH="${KOYEB_GIT_BRANCH:-}"
INPUT_KOYEB_GIT_REPO="${KOYEB_GIT_REPO:-}"
INPUT_KOYEB_APP_PORT="${KOYEB_APP_PORT:-}"
INPUT_KOYEB_STATIC_ROOT="${KOYEB_STATIC_ROOT:-}"
INPUT_KOYEB_WAIT_TIMEOUT="${KOYEB_WAIT_TIMEOUT:-}"
INPUT_KOYEB_TOKEN="${KOYEB_TOKEN:-}"
INPUT_KOYEB_ORGANIZATION="${KOYEB_ORGANIZATION:-}"
INPUT_KOYEB_MANIFEST="${KOYEB_MANIFEST:-}"
INPUT_KOYEB_DRY_RUN="${KOYEB_DRY_RUN:-}"
INPUT_APP_PUBLIC_PORT="${APP_PUBLIC_PORT:-}"
INPUT_APP_STATIC_ROOT="${APP_STATIC_ROOT:-}"

KOYEB_APP_NAME="${INPUT_KOYEB_APP_NAME}"
KOYEB_SERVICE_NAME="${INPUT_KOYEB_SERVICE_NAME}"
KOYEB_GIT_BRANCH="${INPUT_KOYEB_GIT_BRANCH}"
KOYEB_GIT_REPO="${INPUT_KOYEB_GIT_REPO}"
KOYEB_APP_PORT="${INPUT_KOYEB_APP_PORT}"
KOYEB_STATIC_ROOT="${INPUT_KOYEB_STATIC_ROOT}"
KOYEB_WAIT_TIMEOUT="${INPUT_KOYEB_WAIT_TIMEOUT}"
KOYEB_TOKEN="${INPUT_KOYEB_TOKEN}"
KOYEB_ORGANIZATION="${INPUT_KOYEB_ORGANIZATION}"
KOYEB_MANIFEST="${INPUT_KOYEB_MANIFEST:-koyeb.yaml}"
KOYEB_DRY_RUN="${INPUT_KOYEB_DRY_RUN}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: required command not found: $1" >&2
    exit 1
  fi
}

derive_git_repo() {
  local remote
  remote="$(git remote get-url origin 2>/dev/null || true)"
  if [[ -z "$remote" ]]; then
    return 1
  fi

  case "$remote" in
    git@github.com:*.git)
      remote="${remote#git@github.com:}"
      remote="${remote%.git}"
      ;;
    git@github.com:*)
      remote="${remote#git@github.com:}"
      ;;
    https://github.com/*.git)
      remote="${remote#https://github.com/}"
      remote="${remote%.git}"
      ;;
    https://github.com/*)
      remote="${remote#https://github.com/}"
      ;;
    *)
      return 1
      ;;
  esac

  printf 'github.com/%s\n' "$remote"
}

load_shared_env() {
  if [[ -f .env.deploy ]]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env.deploy
    set +a
  fi
}

restore_explicit_env() {
  if [[ -n "$INPUT_KOYEB_APP_NAME" ]]; then
    KOYEB_APP_NAME="$INPUT_KOYEB_APP_NAME"
  fi
  if [[ -n "$INPUT_KOYEB_SERVICE_NAME" ]]; then
    KOYEB_SERVICE_NAME="$INPUT_KOYEB_SERVICE_NAME"
  fi
  if [[ -n "$INPUT_KOYEB_GIT_BRANCH" ]]; then
    KOYEB_GIT_BRANCH="$INPUT_KOYEB_GIT_BRANCH"
  fi
  if [[ -n "$INPUT_KOYEB_GIT_REPO" ]]; then
    KOYEB_GIT_REPO="$INPUT_KOYEB_GIT_REPO"
  fi
  if [[ -n "$INPUT_KOYEB_APP_PORT" ]]; then
    KOYEB_APP_PORT="$INPUT_KOYEB_APP_PORT"
  fi
  if [[ -n "$INPUT_KOYEB_STATIC_ROOT" ]]; then
    KOYEB_STATIC_ROOT="$INPUT_KOYEB_STATIC_ROOT"
  fi
  if [[ -n "$INPUT_KOYEB_WAIT_TIMEOUT" ]]; then
    KOYEB_WAIT_TIMEOUT="$INPUT_KOYEB_WAIT_TIMEOUT"
  fi
  if [[ -n "$INPUT_KOYEB_TOKEN" ]]; then
    KOYEB_TOKEN="$INPUT_KOYEB_TOKEN"
  fi
  if [[ -n "$INPUT_KOYEB_ORGANIZATION" ]]; then
    KOYEB_ORGANIZATION="$INPUT_KOYEB_ORGANIZATION"
  fi
  if [[ -n "$INPUT_KOYEB_MANIFEST" ]]; then
    KOYEB_MANIFEST="$INPUT_KOYEB_MANIFEST"
  fi
  if [[ -n "$INPUT_KOYEB_DRY_RUN" ]]; then
    KOYEB_DRY_RUN="$INPUT_KOYEB_DRY_RUN"
  fi
  if [[ -n "$INPUT_APP_PUBLIC_PORT" ]]; then
    APP_PUBLIC_PORT="$INPUT_APP_PUBLIC_PORT"
  fi
  if [[ -n "$INPUT_APP_STATIC_ROOT" ]]; then
    APP_STATIC_ROOT="$INPUT_APP_STATIC_ROOT"
  fi
}

yaml_get() {
  local key="$1"
  local file="$2"
  [[ -f "$file" ]] || return 1
  awk -F ': *' -v target="$key" '
    $1 == target {
      value = substr($0, index($0, ":") + 1)
      sub(/^ +/, "", value)
      sub(/^"/, "", value)
      sub(/"$/, "", value)
      sub(/^'\''/, "", value)
      sub(/'\''$/, "", value)
      print value
      exit
    }
  ' "$file"
}

load_manifest_defaults() {
  local value
  [[ -f "$KOYEB_MANIFEST" ]] || return 0

  value="$(yaml_get app_name "$KOYEB_MANIFEST" || true)"
  if [[ -z "$KOYEB_APP_NAME" && -n "$value" ]]; then
    KOYEB_APP_NAME="$value"
  fi
  value="$(yaml_get service_name "$KOYEB_MANIFEST" || true)"
  if [[ -z "$KOYEB_SERVICE_NAME" && -n "$value" ]]; then
    KOYEB_SERVICE_NAME="$value"
  fi
  value="$(yaml_get git_branch "$KOYEB_MANIFEST" || true)"
  if [[ -z "$KOYEB_GIT_BRANCH" && -n "$value" ]]; then
    KOYEB_GIT_BRANCH="$value"
  fi
  value="$(yaml_get git_repo "$KOYEB_MANIFEST" || true)"
  if [[ -z "$KOYEB_GIT_REPO" && -n "$value" ]]; then
    KOYEB_GIT_REPO="$value"
  fi
  value="$(yaml_get app_port "$KOYEB_MANIFEST" || true)"
  if [[ -z "$KOYEB_APP_PORT" && -n "$value" ]]; then
    KOYEB_APP_PORT="$value"
  fi
  value="$(yaml_get static_root "$KOYEB_MANIFEST" || true)"
  if [[ -z "$KOYEB_STATIC_ROOT" && -n "$value" ]]; then
    KOYEB_STATIC_ROOT="$value"
  fi
  value="$(yaml_get wait_timeout "$KOYEB_MANIFEST" || true)"
  if [[ -z "$KOYEB_WAIT_TIMEOUT" && -n "$value" ]]; then
    KOYEB_WAIT_TIMEOUT="$value"
  fi
}

apply_defaults() {
  KOYEB_APP_NAME="${KOYEB_APP_NAME:-taas-demo}"
  KOYEB_SERVICE_NAME="${KOYEB_SERVICE_NAME:-$KOYEB_APP_NAME}"
  KOYEB_GIT_BRANCH="${KOYEB_GIT_BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"
  KOYEB_APP_PORT="${KOYEB_APP_PORT:-${APP_PUBLIC_PORT:-8080}}"
  KOYEB_STATIC_ROOT="${KOYEB_STATIC_ROOT:-${APP_STATIC_ROOT:-/srv/taas}}"
  KOYEB_WAIT_TIMEOUT="${KOYEB_WAIT_TIMEOUT:-10m}"
  KOYEB_DRY_RUN="${KOYEB_DRY_RUN:-false}"
}

is_true() {
  case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in
    1|true|yes|on)
      return 0
      ;;
  esac
  return 1
}

print_cmd() {
  local arg
  printf '+'
  for arg in "$@"; do
    printf ' %q' "$arg"
  done
  printf '\n'
}

run_koyeb_cmd() {
  local cmd=(koyeb)
  if [[ -n "$KOYEB_TOKEN" ]]; then
    cmd+=(--token "$KOYEB_TOKEN")
  fi
  if [[ -n "$KOYEB_ORGANIZATION" ]]; then
    cmd+=(--organization "$KOYEB_ORGANIZATION")
  fi
  if is_true "$KOYEB_DRY_RUN"; then
    print_cmd "${cmd[@]}" "$@"
    return 0
  fi
  "${cmd[@]}" "$@"
}

print_koyeb_cmd() {
  local cmd=(koyeb)
  if [[ -n "$KOYEB_TOKEN" ]]; then
    cmd+=(--token "$KOYEB_TOKEN")
  fi
  if [[ -n "$KOYEB_ORGANIZATION" ]]; then
    cmd+=(--organization "$KOYEB_ORGANIZATION")
  fi
  print_cmd "${cmd[@]}" "$@"
}

ensure_prereqs() {
  require_cmd git
  if ! is_true "$KOYEB_DRY_RUN"; then
    require_cmd koyeb
  fi
  load_shared_env
  restore_explicit_env
  load_manifest_defaults
  apply_defaults

  if [[ -z "$KOYEB_GIT_REPO" ]]; then
    KOYEB_GIT_REPO="$(derive_git_repo || true)"
  fi

  if [[ -z "$KOYEB_GIT_REPO" ]]; then
    echo "error: unable to derive a GitHub repository from origin; set KOYEB_GIT_REPO=github.com/<user>/<repo>" >&2
    exit 1
  fi

  if is_true "$KOYEB_DRY_RUN"; then
    return 0
  fi

  if ! run_koyeb_cmd apps list >/dev/null 2>&1; then
    echo "error: Koyeb CLI is not authenticated. Run 'koyeb login' or set KOYEB_TOKEN." >&2
    exit 1
  fi
}

create_or_update() {
  if is_true "$KOYEB_DRY_RUN"; then
    echo "Dry run enabled; not contacting Koyeb. These are the commands that would be used."
    echo
    echo "If the app already exists, the redeploy path would be:"
    print_koyeb_cmd services redeploy "$KOYEB_SERVICE_NAME" \
      --app "$KOYEB_APP_NAME" \
      --wait \
      --wait-timeout "$KOYEB_WAIT_TIMEOUT"
    echo
    echo "If the app does not exist yet, the init path would be:"
    print_koyeb_cmd apps init "$KOYEB_APP_NAME" \
      --git "$KOYEB_GIT_REPO" \
      --git-branch "$KOYEB_GIT_BRANCH" \
      --git-builder docker \
      --ports "${KOYEB_APP_PORT}:http" \
      --routes "/:${KOYEB_APP_PORT}" \
      --env "PORT=${KOYEB_APP_PORT}" \
      --env "STATIC_ROOT=${KOYEB_STATIC_ROOT}"
    return 0
  fi

  if run_koyeb_cmd apps get "$KOYEB_APP_NAME" >/dev/null 2>&1; then
    echo "Koyeb app exists; triggering redeploy for ${KOYEB_APP_NAME}/${KOYEB_SERVICE_NAME}"
    run_koyeb_cmd services redeploy "$KOYEB_SERVICE_NAME" \
      --app "$KOYEB_APP_NAME" \
      --wait \
      --wait-timeout "$KOYEB_WAIT_TIMEOUT"
  else
    echo "Creating Koyeb app '${KOYEB_APP_NAME}' from ${KOYEB_GIT_REPO}@${KOYEB_GIT_BRANCH}"
    run_koyeb_cmd apps init "$KOYEB_APP_NAME" \
      --git "$KOYEB_GIT_REPO" \
      --git-branch "$KOYEB_GIT_BRANCH" \
      --git-builder docker \
      --ports "${KOYEB_APP_PORT}:http" \
      --routes "/:${KOYEB_APP_PORT}" \
      --env "PORT=${KOYEB_APP_PORT}" \
      --env "STATIC_ROOT=${KOYEB_STATIC_ROOT}"
  fi
}

print_followups() {
  echo
  echo "Build logs:"
  echo "  koyeb services logs ${KOYEB_APP_NAME}/${KOYEB_SERVICE_NAME} -t build --tail"
  echo
  echo "Runtime logs:"
  echo "  koyeb services logs ${KOYEB_APP_NAME}/${KOYEB_SERVICE_NAME} -t runtime --tail"
  echo
  echo "App details:"
  if is_true "$KOYEB_DRY_RUN"; then
    print_koyeb_cmd apps get "$KOYEB_APP_NAME"
    return 0
  fi
  run_koyeb_cmd apps get "$KOYEB_APP_NAME" || true
}

main() {
  ensure_prereqs
  create_or_update
  print_followups
}

main "$@"
