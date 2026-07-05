#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"
load_runtime_env

BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"
BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"

wait_backend() {
  local timeout_seconds="${1:-45}"
  local elapsed=0
  local health_url="http://127.0.0.1:${SOVEREIGN_PORT}/api/health"

  while [[ "$elapsed" -lt "$timeout_seconds" ]]; do
    if curl -sS -m 3 "$health_url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  return 1
}

wait_frontend() {
  local timeout_seconds="${1:-45}"
  local elapsed=0
  local health_url="http://127.0.0.1:${FRONTEND_PORT:-5173}/api/health"

  while [[ "$elapsed" -lt "$timeout_seconds" ]]; do
    if curl -sS -m 3 "$health_url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  return 1
}

index_local_documents() {
  if [[ "${SOVEREIGN_AUTO_INDEX_LOCAL_DOCS:-1}" != "1" ]]; then
    log "Skipping local document indexing (SOVEREIGN_AUTO_INDEX_LOCAL_DOCS=${SOVEREIGN_AUTO_INDEX_LOCAL_DOCS:-0})"
    return 0
  fi

  if [[ ! -d "$SOVEREIGN_LOCAL_DOCS_DIR" ]]; then
    warn "Local documents directory not found: $SOVEREIGN_LOCAL_DOCS_DIR"
    return 0
  fi

  local escaped_path
  escaped_path="${SOVEREIGN_LOCAL_DOCS_DIR//\\/\\\\}"
  escaped_path="${escaped_path//\"/\\\"}"

  local payload
  payload="{\"path\":\"$escaped_path\",\"source_type\":\"local-docs\",\"source_id\":\"$HOSTNAME-local-docs\"}"

  if curl -sS -m 20 -H "Content-Type: application/json" -d "$payload" "http://127.0.0.1:${SOVEREIGN_PORT}/api/index/path" >/dev/null 2>&1; then
    log "Local document retrieval source indexed: $SOVEREIGN_LOCAL_DOCS_DIR"
  else
    warn "Unable to index local documents now. You can retry from the Library page."
  fi
}

start_backend() {
  log "Starting backend"
  cd "$BACKEND_DIR"
  # shellcheck disable=SC1091
  source .venv/bin/activate
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  nohup uvicorn app.main:app --host "$SOVEREIGN_HOST" --port "$SOVEREIGN_PORT" > "$BACKEND_LOG" 2>&1 &
  echo $! > "$BACKEND_PID_FILE"
}

start_frontend() {
  log "Starting frontend"
  cd "$FRONTEND_DIR"
  nohup npm run dev -- --host 0.0.0.0 --port "${FRONTEND_PORT:-5173}" --strictPort > "$FRONTEND_LOG" 2>&1 &
  echo $! > "$FRONTEND_PID_FILE"
}

open_browser() {
  local url="http://127.0.0.1:${FRONTEND_PORT:-5173}"
  log "Opening $url"
  if [[ -n "${BROWSER:-}" ]]; then
    "$BROWSER" "$url" >/dev/null 2>&1 || true
  elif has_cmd xdg-open; then
    xdg-open "$url" >/dev/null 2>&1 || true
  fi
}

start_backend
if wait_backend 45; then
  log "Backend health check passed"
  index_local_documents
else
  warn "Backend did not become healthy in time; skipping auto-index on this launch"
fi
start_frontend
if wait_frontend 45; then
  log "Frontend health check passed"
else
  err "Frontend did not become healthy on port ${FRONTEND_PORT:-5173}. Check $FRONTEND_LOG"
  exit 1
fi
open_browser

log "Services launched"
log "Backend log: $BACKEND_LOG"
log "Frontend log: $FRONTEND_LOG"
