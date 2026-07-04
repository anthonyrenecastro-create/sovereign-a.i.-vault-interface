#!/usr/bin/env bash
set -euo pipefail

TARGET_ROOT="${HOME}/sovereign-vault-node"
NO_BROWSER=0

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET_ROOT="$2"
      shift 2
      ;;
    --no-browser)
      NO_BROWSER=1
      shift
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 2
      ;;
  esac
done

LAUNCHER="$TARGET_ROOT/portable-kit/scripts/launch.sh"
if [[ ! -x "$LAUNCHER" ]]; then
  echo "Launcher not found or not executable: $LAUNCHER" >&2
  exit 1
fi

if [[ "$NO_BROWSER" == "1" ]]; then
  BROWSER=true "$LAUNCHER"
else
  "$LAUNCHER"
fi
