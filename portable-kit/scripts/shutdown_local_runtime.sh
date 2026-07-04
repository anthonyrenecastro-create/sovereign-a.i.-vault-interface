#!/usr/bin/env bash
set -euo pipefail

TARGET_ROOT="${HOME}/sovereign-vault-node"

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET_ROOT="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

SHUTDOWN="$TARGET_ROOT/portable-kit/scripts/shutdown.sh"
if [[ ! -x "$SHUTDOWN" ]]; then
  echo "Shutdown script not found or not executable: $SHUTDOWN" >&2
  exit 1
fi

"$SHUTDOWN"
