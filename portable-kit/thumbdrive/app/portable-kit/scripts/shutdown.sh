#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

stop_pid_file() {
  local file="$1"
  local name="$2"
  if [[ -f "$file" ]]; then
    local pid
    pid="$(cat "$file")"
    if kill -0 "$pid" >/dev/null 2>&1; then
      log "Stopping $name ($pid)"
      kill "$pid" || true
    fi
    rm -f "$file"
  fi
}

stop_pid_file "$PID_DIR/frontend.pid" "frontend"
stop_pid_file "$PID_DIR/backend.pid" "backend"
log "Shutdown complete"
