#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

UPDATES_DIR="$KIT_DIR/updates"
if [[ ! -d "$UPDATES_DIR" ]]; then
  warn "No updates directory found at $UPDATES_DIR"
  exit 0
fi

log "Applying updates from $UPDATES_DIR"
rsync -av --exclude '.git' "$UPDATES_DIR/" "$REPO_DIR/"

log "Re-running bootstrap after update"
"$SCRIPT_DIR/bootstrap.sh" --skip-model-pull
log "Update complete"
