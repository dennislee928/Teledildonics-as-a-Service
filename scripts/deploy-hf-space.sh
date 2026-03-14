#!/usr/bin/env bash
set -euo pipefail

HF_SPACE_ID="${HF_SPACE_ID:-}"
HF_SPACE_BRANCH="${HF_SPACE_BRANCH:-main}"
HF_SPACE_TITLE="${HF_SPACE_TITLE:-TaaS Demo}"
HF_SPACE_EMOJI="${HF_SPACE_EMOJI:-🛰️}"
HF_SPACE_COLOR_FROM="${HF_SPACE_COLOR_FROM:-red}"
HF_SPACE_COLOR_TO="${HF_SPACE_COLOR_TO:-orange}"
HF_SPACE_PRIVATE="${HF_SPACE_PRIVATE:-false}"
HF_SPACE_STAGE_DIR="${HF_SPACE_STAGE_DIR:-.tmp-deploy/hf-space}"
HF_USERNAME="${HF_USERNAME:-}"
HF_TOKEN="${HF_TOKEN:-}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: required command not found: $1" >&2
    exit 1
  fi
}

derive_hf_username() {
  local whoami
  whoami="$(hf auth whoami 2>/dev/null || true)"
  if [[ -n "$whoami" ]]; then
    printf '%s\n' "$whoami" | awk 'NR == 1 { if ($1 ~ /:$/ && NF >= 2) { print $2 } else { print $1 } }'
    return 0
  fi
  if [[ "$HF_SPACE_ID" == */* ]]; then
    printf '%s\n' "${HF_SPACE_ID%%/*}"
    return 0
  fi
  return 1
}

load_shared_env() {
  if [[ -f .env.deploy ]]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env.deploy
    set +a
  fi
}

apply_defaults() {
  HF_SPACE_BRANCH="${HF_SPACE_BRANCH:-main}"
  HF_SPACE_TITLE="${HF_SPACE_TITLE:-TaaS Demo}"
  HF_SPACE_EMOJI="${HF_SPACE_EMOJI:-🛰️}"
  HF_SPACE_COLOR_FROM="${HF_SPACE_COLOR_FROM:-red}"
  HF_SPACE_COLOR_TO="${HF_SPACE_COLOR_TO:-orange}"
  HF_SPACE_PRIVATE="${HF_SPACE_PRIVATE:-false}"
  HF_SPACE_STAGE_DIR="${HF_SPACE_STAGE_DIR:-.tmp-deploy/hf-space}"
}

ensure_prereqs() {
  require_cmd git
  require_cmd hf
  require_cmd rsync
  load_shared_env
  apply_defaults

  if [[ -z "$HF_SPACE_ID" ]]; then
    echo "error: HF_SPACE_ID is required, for example HF_SPACE_ID=your-user/taas-demo" >&2
    exit 1
  fi

  if [[ -z "$HF_USERNAME" ]]; then
    HF_USERNAME="$(derive_hf_username || true)"
  fi

  if [[ -z "$HF_TOKEN" ]]; then
    echo "HF_TOKEN not set; relying on git credentials configured by 'hf auth login --add-to-git-credential'."
  elif [[ -z "$HF_USERNAME" ]]; then
    echo "error: HF_TOKEN is set but HF_USERNAME could not be determined. Set HF_USERNAME explicitly." >&2
    exit 1
  fi
}

stage_repo() {
  local stage_root="$HF_SPACE_STAGE_DIR/$(basename "$HF_SPACE_ID")"
  rm -rf "$stage_root"
  mkdir -p "$stage_root"

  rsync -a \
    --exclude '.git/' \
    --exclude 'node_modules/' \
    --exclude 'target/' \
    --exclude '.tmp-deploy/' \
    --exclude 'docs/' \
    --exclude 'plan.md' \
    --exclude 'Cargo.lock' \
    ./ "$stage_root/"

  cat >"$stage_root/README.md" <<EOF
---
title: ${HF_SPACE_TITLE}
emoji: "${HF_SPACE_EMOJI}"
colorFrom: ${HF_SPACE_COLOR_FROM}
colorTo: ${HF_SPACE_COLOR_TO}
sdk: docker
app_port: 8080
---

# ${HF_SPACE_TITLE}

This Space mirrors the TaaS demo deployment from the main repository.

- API: \`/v1/*\`
- Health check: \`/healthz\`
- Hosted control demo: \`/demo/hosted-control/\`
- Creator console demo: \`/demo/creator-console/\`

This is a public demo surface, not the production realtime control plane.
EOF

  printf '%s\n' "$stage_root"
}

ensure_space_repo() {
  local args=(repo create "$HF_SPACE_ID" --repo-type space --space-sdk docker --exist-ok)
  if [[ "$HF_SPACE_PRIVATE" == "true" ]]; then
    args+=(--private)
  fi
  hf "${args[@]}"
}

push_space() {
  local stage_root="$1"
  local remote_url="https://huggingface.co/spaces/${HF_SPACE_ID}"

  pushd "$stage_root" >/dev/null
  git init -b "$HF_SPACE_BRANCH" >/dev/null
  git config user.name "TaaS Deploy Bot"
  git config user.email "taas-demo@example.invalid"
  git add .
  git commit -m "Deploy TaaS Space" >/dev/null

  if [[ -n "$HF_TOKEN" ]]; then
    remote_url="https://${HF_USERNAME}:${HF_TOKEN}@huggingface.co/spaces/${HF_SPACE_ID}"
  fi

  git push --force "$remote_url" "HEAD:${HF_SPACE_BRANCH}"
  popd >/dev/null
}

main() {
  ensure_prereqs
  ensure_space_repo
  stage_root="$(stage_repo)"
  push_space "$stage_root"
  echo
  echo "Space pushed successfully:"
  echo "  https://huggingface.co/spaces/${HF_SPACE_ID}"
  echo "  https://$(printf '%s' "$HF_SPACE_ID" | tr '/' '-').hf.space"
}

main "$@"
