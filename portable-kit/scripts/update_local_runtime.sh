#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

TARGET_ROOT="${HOME}/sovereign-vault-node"

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET_ROOT="$2"
      shift 2
      ;;
    *)
      err "Unknown option: $1"
      exit 2
      ;;
  esac
done

if [[ ! -d "$TARGET_ROOT" ]]; then
  err "Target node does not exist: $TARGET_ROOT"
  exit 1
fi

log "Updating local runtime node from USB/package"
log "Source: $REPO_DIR"
log "Target: $TARGET_ROOT"

rsync -av --delete \
  --exclude '.git' \
  --exclude 'frontend/node_modules' \
  --exclude 'frontend/dist' \
  --exclude 'backend/.venv' \
  --exclude 'portable-kit/runtime' \
  --exclude 'extracted' \
  --exclude '*.zip' \
  "$REPO_DIR/" "$TARGET_ROOT/"

log "Re-running bootstrap on target to align dependencies"
"$TARGET_ROOT/portable-kit/scripts/bootstrap.sh" --skip-model-pull

log "Update complete"
