#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

INSTALL_OLLAMA=0
SKIP_MODEL_PULL=0
NO_BROWSER=0

for arg in "$@"; do
  case "$arg" in
    --install-ollama)
      INSTALL_OLLAMA=1
      ;;
    --skip-model-pull)
      SKIP_MODEL_PULL=1
      ;;
    --no-browser)
      NO_BROWSER=1
      ;;
    *)
      ;;
  esac
done

BACKEND_URL="http://127.0.0.1:8000"
FRONTEND_URL="http://127.0.0.1:5173"

PASS=0
FAIL=0
WARN=0

report_pass() {
  PASS=$((PASS + 1))
  log "PASS: $*"
}

report_fail() {
  FAIL=$((FAIL + 1))
  err "FAIL: $*"
}

report_warn() {
  WARN=$((WARN + 1))
  warn "$*"
}

wait_http_ok() {
  local url="$1"
  local timeout_seconds="$2"
  local elapsed=0

  while [[ "$elapsed" -lt "$timeout_seconds" ]]; do
    if curl -sS -m 3 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    elapsed=$((elapsed + 1))
  done

  return 1
}

log "Field Installer starting"

BOOTSTRAP_ARGS=()
if [[ "$INSTALL_OLLAMA" == "1" ]]; then
  BOOTSTRAP_ARGS+=("--install-ollama")
fi
if [[ "$SKIP_MODEL_PULL" == "1" ]]; then
  BOOTSTRAP_ARGS+=("--skip-model-pull")
fi

"$SCRIPT_DIR/bootstrap.sh" "${BOOTSTRAP_ARGS[@]}"

if [[ "$NO_BROWSER" == "1" ]]; then
  BROWSER=true "$SCRIPT_DIR/launch.sh"
else
  "$SCRIPT_DIR/launch.sh"
fi

if wait_http_ok "$BACKEND_URL/api/health" 30; then
  report_pass "Backend health endpoint reachable"
else
  report_fail "Backend health endpoint not reachable at $BACKEND_URL/api/health"
fi

if wait_http_ok "$FRONTEND_URL" 30; then
  report_pass "Frontend reachable"
else
  report_fail "Frontend not reachable at $FRONTEND_URL"
fi

if wait_http_ok "$FRONTEND_URL/api/health" 30; then
  report_pass "Frontend API proxy path reachable"
else
  report_fail "Frontend API proxy path not reachable at $FRONTEND_URL/api/health"
fi

if curl -sS -m 5 "$FRONTEND_URL/api/assistants" >/dev/null 2>&1; then
  report_pass "Assistants endpoint reachable"
else
  report_fail "Assistants endpoint failed"
fi

if has_cmd ollama; then
  if curl -sS -m 4 http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
    report_pass "Ollama API reachable"
  else
    report_warn "Ollama CLI present but API not reachable at http://127.0.0.1:11434"
  fi
else
  report_warn "Ollama CLI not found; chat/model operations may fail until installed"
fi

TOTAL=$((PASS + FAIL))

echo
echo "===== FIELD INSTALL REPORT ====="
echo "Pass: $PASS"
echo "Fail: $FAIL"
echo "Warn: $WARN"
echo "Checked: $TOTAL"
if [[ "$FAIL" -eq 0 ]]; then
  echo "Result: PASS"
  exit 0
else
  echo "Result: FAIL"
  exit 1
fi
