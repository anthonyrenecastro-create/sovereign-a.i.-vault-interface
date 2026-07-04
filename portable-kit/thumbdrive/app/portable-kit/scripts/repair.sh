#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

log "Running repair checks"

if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
  warn "Backend venv missing. Re-running bootstrap."
  "$SCRIPT_DIR/bootstrap.sh"
fi

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  warn "Frontend dependencies missing. Re-running bootstrap."
  "$SCRIPT_DIR/bootstrap.sh"
fi

if ! curl -sS --max-time 4 http://127.0.0.1:8000/api/health >/dev/null 2>&1; then
  warn "Backend health check failed. Restarting services."
  "$SCRIPT_DIR/shutdown.sh"
  "$SCRIPT_DIR/launch.sh"
fi

if ! curl -sS --max-time 4 http://127.0.0.1:5173/api/health >/dev/null 2>&1; then
  warn "Frontend proxy health check failed. Restarting services."
  "$SCRIPT_DIR/shutdown.sh"
  "$SCRIPT_DIR/launch.sh"
fi

"$SCRIPT_DIR/model_manager.sh" status || true
log "Repair routine complete"
