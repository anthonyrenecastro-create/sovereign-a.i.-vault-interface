#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

INSTALL_OLLAMA=0
PULL_MODELS=1

for arg in "$@"; do
  case "$arg" in
    --install-ollama) INSTALL_OLLAMA=1 ;;
    --skip-model-pull) PULL_MODELS=0 ;;
  esac
done

log "Initializing Sovereign Vault Portable Deployment Kit"

CPU_CORES="$(get_cpu_cores)"
MEM_GB="$(get_mem_gb)"
DISK_FREE_GB="$(get_disk_free_gb)"
MIN_MODE="$(get_min_mode "$MEM_GB")"
HW_TIER="$(detect_hw_tier "$MEM_GB" "$CPU_CORES")"

save_runtime_env "$MEM_GB" "$MIN_MODE" "$CPU_CORES" "$HW_TIER"
load_runtime_env

log "Hardware profile: tier=${SOVEREIGN_HW_TIER} cpu=${CPU_CORES} mem=${MEM_GB}GB disk_free=${DISK_FREE_GB}GB min_mode=${SOVEREIGN_MIN_MEMORY_MODE}"

mkdir -p "$SOVEREIGN_LOCAL_DOCS_DIR"
if [[ ! -f "$SOVEREIGN_LOCAL_DOCS_DIR/README.txt" ]]; then
  cat > "$SOVEREIGN_LOCAL_DOCS_DIR/README.txt" <<EOF
Drop local files in this folder to make them available for Sovereign Vault retrieval indexing.
Path: $SOVEREIGN_LOCAL_DOCS_DIR
EOF
fi

if [[ -f "$PROFILES_TEMPLATE_FILE" ]]; then
  if [[ ! -f "$SOVEREIGN_ASSISTANT_PROFILES_FILE" ]]; then
    cp "$PROFILES_TEMPLATE_FILE" "$SOVEREIGN_ASSISTANT_PROFILES_FILE"
    log "Activated assistant profiles from template: $SOVEREIGN_ASSISTANT_PROFILES_FILE"
  else
    log "Assistant profiles already active: $SOVEREIGN_ASSISTANT_PROFILES_FILE"
  fi
else
  warn "Assistant profile template not found at $PROFILES_TEMPLATE_FILE"
fi

if ! has_cmd python3; then
  err "python3 is required"
  exit 1
fi
if ! has_cmd npm; then
  err "npm is required"
  exit 1
fi

if has_cmd ollama; then
  log "Ollama detected on host. Will connect to local runtime at ${OLLAMA_BASE_URL}."
elif [[ "$INSTALL_OLLAMA" == "1" ]]; then
  log "Ollama not detected; attempting install because --install-ollama was provided."
  "$SCRIPT_DIR/model_manager.sh" ensure --install || warn "Unable to install Ollama automatically."
elif internet_available; then
  log "Ollama not detected; internet is available, attempting auto-install."
  "$SCRIPT_DIR/model_manager.sh" ensure --install || warn "Auto-install failed; install Ollama manually if needed."
else
  warn "Ollama not detected and host appears offline. Continuing in offline-ready mode."
fi

if [[ ! -d "$BACKEND_DIR/.venv" ]]; then
  log "Creating backend virtual environment"
  python3 -m venv "$BACKEND_DIR/.venv"
fi

# shellcheck disable=SC1091
source "$BACKEND_DIR/.venv/bin/activate"
log "Installing backend dependencies"
pip install -q -r "$BACKEND_DIR/requirements.txt"

log "Installing frontend dependencies"
cd "$FRONTEND_DIR"
npm install --silent

cat > "$BACKEND_DIR/.env" <<EOF
SOVEREIGN_HOST=${SOVEREIGN_HOST}
SOVEREIGN_PORT=${SOVEREIGN_PORT}
OLLAMA_BASE_URL=${OLLAMA_BASE_URL}
OLLAMA_MODEL_DEFAULT=${OLLAMA_MODEL_DEFAULT}
OLLAMA_MODEL_REASONING=${OLLAMA_MODEL_REASONING}
OLLAMA_MODEL_CODER=${OLLAMA_MODEL_CODER}
OLLAMA_MODEL_FAST=${OLLAMA_MODEL_FAST}
OLLAMA_MODEL_EMBEDDING=${OLLAMA_MODEL_EMBEDDING}
SOVEREIGN_DATA_DIR=${SOVEREIGN_DATA_DIR}
SOVEREIGN_ADMIN_TOKEN=change-me
SOVEREIGN_AUTH_SECRET=change-this-auth-secret
SOVEREIGN_AUTH_TOKEN_TTL_MINUTES=480
SOVEREIGN_BOOTSTRAP_ADMIN_USERNAME=admin
SOVEREIGN_BOOTSTRAP_ADMIN_PASSWORD=change-me-now
EOF

cat > "$FRONTEND_DIR/.env" <<EOF
VITE_API_BASE_URL=
EOF

if [[ "$PULL_MODELS" == "1" ]]; then
  "$SCRIPT_DIR/model_manager.sh" pull || true
fi

log "Bootstrap complete"
log "Next: run $SCRIPT_DIR/launch.sh"
