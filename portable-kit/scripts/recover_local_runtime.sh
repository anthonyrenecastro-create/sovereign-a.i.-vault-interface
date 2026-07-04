#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

TARGET_ROOT="${HOME}/sovereign-vault-node"
BACKUP_DIR=""

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET_ROOT="$2"
      shift 2
      ;;
    --backup)
      BACKUP_DIR="$2"
      shift 2
      ;;
    *)
      err "Unknown option: $1"
      exit 2
      ;;
  esac
done

if [[ -z "$BACKUP_DIR" ]]; then
  err "Provide --backup <path>"
  exit 2
fi

if [[ ! -d "$BACKUP_DIR/runtime" ]]; then
  err "Backup runtime folder missing: $BACKUP_DIR/runtime"
  exit 1
fi

mkdir -p "$TARGET_ROOT/portable-kit/runtime"
log "Recovering runtime to $TARGET_ROOT/portable-kit/runtime"
rsync -av --delete "$BACKUP_DIR/runtime/" "$TARGET_ROOT/portable-kit/runtime/"

log "Recovery complete"
