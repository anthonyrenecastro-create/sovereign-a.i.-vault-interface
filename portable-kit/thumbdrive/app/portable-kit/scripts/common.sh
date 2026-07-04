#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KIT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$KIT_DIR/.." && pwd)"

DRIVE_ROOT_CANDIDATE="$(cd "$KIT_DIR/../.." && pwd)"
THUMBDRIVE_LAYOUT_MODE=0

if [[ -d "$DRIVE_ROOT_CANDIDATE/app" && -d "$DRIVE_ROOT_CANDIDATE/models" && -d "$DRIVE_ROOT_CANDIDATE/data" ]]; then
  THUMBDRIVE_LAYOUT_MODE=1
fi

if [[ "$THUMBDRIVE_LAYOUT_MODE" == "1" ]]; then
  DRIVE_ROOT="$DRIVE_ROOT_CANDIDATE"

  RUNTIME_DIR="$DRIVE_ROOT/cache/runtime"
  LOG_DIR="$DRIVE_ROOT/data/logs"
  PID_DIR="$DRIVE_ROOT/cache/pids"
  EXPORT_DIR="$DRIVE_ROOT/data/exports"
  WORKSPACE_DIR="$DRIVE_ROOT/data/conversations"
  DATA_DIR="$DRIVE_ROOT/data/system"
  VECTOR_DIR="$DRIVE_ROOT/data/vector"
  MODEL_CACHE_DIR="$DRIVE_ROOT/models"
  TMP_DIR="$DRIVE_ROOT/cache/tmp"
  CONFIG_DIR="$DATA_DIR/config"
  LOCAL_DOCS_DIR="$DRIVE_ROOT/data/documents"
  ENV_FILE="$DATA_DIR/runtime.env"
else
  RUNTIME_DIR="$KIT_DIR/runtime"
  LOG_DIR="$RUNTIME_DIR/logs"
  PID_DIR="$RUNTIME_DIR/pids"
  EXPORT_DIR="$RUNTIME_DIR/exports"
  WORKSPACE_DIR="$RUNTIME_DIR/workspace"
  DATA_DIR="$RUNTIME_DIR/data"
  VECTOR_DIR="$DATA_DIR/vector"
  MODEL_CACHE_DIR="$RUNTIME_DIR/models"
  TMP_DIR="$RUNTIME_DIR/tmp"
  CONFIG_DIR="$RUNTIME_DIR/config"
  LOCAL_DOCS_DIR="$WORKSPACE_DIR/documents"
  ENV_FILE="$RUNTIME_DIR/runtime.env"
fi

PROFILES_TEMPLATE_FILE="$KIT_DIR/config/assistant_profiles.template.json"
PROFILES_ACTIVE_FILE="$CONFIG_DIR/assistant_profiles.active.json"

BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR/frontend"

mkdir -p "$RUNTIME_DIR" "$LOG_DIR" "$PID_DIR" "$EXPORT_DIR" "$WORKSPACE_DIR" "$DATA_DIR" "$VECTOR_DIR" "$MODEL_CACHE_DIR" "$TMP_DIR" "$CONFIG_DIR" "$LOCAL_DOCS_DIR"

ts() {
  date +"%Y-%m-%dT%H:%M:%S%z"
}

log() {
  echo "[$(ts)] $*"
}

warn() {
  echo "[$(ts)] WARN: $*" >&2
}

err() {
  echo "[$(ts)] ERROR: $*" >&2
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

internet_available() {
  curl -sS --max-time 3 https://1.1.1.1 >/dev/null 2>&1 || curl -sS --max-time 3 https://example.com >/dev/null 2>&1
}

get_cpu_cores() {
  nproc 2>/dev/null || echo 1
}

get_mem_gb() {
  local mem_kb
  mem_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo 2>/dev/null || echo 0)"
  echo $((mem_kb / 1024 / 1024))
}

get_disk_free_gb() {
  df -BG "$REPO_DIR" 2>/dev/null | awk 'NR==2 {gsub("G","",$4); print $4}' || echo 0
}

get_min_mode() {
  local mem_gb="${1:-0}"
  if [[ "$mem_gb" -lt 8 ]]; then
    echo 1
  else
    echo 0
  fi
}

detect_hw_tier() {
  local mem_gb="${1:-0}"
  local cpu_cores="${2:-1}"

  if [[ "$mem_gb" -lt 16 || "$cpu_cores" -lt 8 ]]; then
    echo "micro-pc"
  else
    echo "high-compute"
  fi
}

load_runtime_env() {
  if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$ENV_FILE"
  fi
}

save_runtime_env() {
  local mem_gb="${1:-8}"
  local min_mode="${2:-0}"
  local cpu_cores="${3:-1}"
  local hw_tier="${4:-micro-pc}"

  local default_model="llama3.1:8b"
  local reasoning_model="llama3.1:8b"
  local coder_model="qwen2.5-coder:7b"
  local fast_model="gemma2:2b"

  if [[ "$min_mode" == "1" ]]; then
    default_model="gemma2:2b"
    reasoning_model="gemma2:2b"
    coder_model="qwen2.5-coder:3b"
  fi

  cat > "$ENV_FILE" <<EOF
SOVEREIGN_LOCAL_ONLY=1
SOVEREIGN_MIN_MEMORY_MODE=$min_mode
SOVEREIGN_MEM_GB=$mem_gb
SOVEREIGN_CPU_CORES=$cpu_cores
SOVEREIGN_HW_TIER=$hw_tier
SOVEREIGN_DATA_DIR=$DATA_DIR
SOVEREIGN_VECTOR_DIR=$VECTOR_DIR
SOVEREIGN_CONVERSATIONS_DIR=$WORKSPACE_DIR
SOVEREIGN_LOCAL_DOCS_DIR=$LOCAL_DOCS_DIR
SOVEREIGN_ASSISTANT_PROFILES_FILE=$PROFILES_ACTIVE_FILE
SOVEREIGN_AUTO_INDEX_LOCAL_DOCS=1
SOVEREIGN_HOST=0.0.0.0
SOVEREIGN_PORT=8000
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL_DEFAULT=$default_model
OLLAMA_MODEL_REASONING=$reasoning_model
OLLAMA_MODEL_CODER=$coder_model
OLLAMA_MODEL_FAST=$fast_model
OLLAMA_MODEL_EMBEDDING=nomic-embed-text
FRONTEND_PORT=5173
EOF
}
