#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

TARGET_ROOT="${HOME}/sovereign-vault-node"
BACKUP_ROOT="$RUNTIME_DIR/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT_DIR="$BACKUP_ROOT/node-backup-$STAMP"

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET_ROOT="$2"
      shift 2
      ;;
    --out)
      OUT_DIR="$2"
      shift 2
      ;;
    *)
      err "Unknown option: $1"
      exit 2
      ;;
  esac
done

if [[ ! -d "$TARGET_ROOT/portable-kit/runtime" ]]; then
  err "Target runtime not found: $TARGET_ROOT/portable-kit/runtime"
  exit 1
fi

mkdir -p "$OUT_DIR"
log "Backing up runtime from $TARGET_ROOT to $OUT_DIR"

rsync -av "$TARGET_ROOT/portable-kit/runtime/" "$OUT_DIR/runtime/"

log "Backup complete: $OUT_DIR"
