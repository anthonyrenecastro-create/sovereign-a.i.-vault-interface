#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"
load_runtime_env

REQUIRED_MODELS=(
  "${OLLAMA_MODEL_DEFAULT:-gemma4:2b}"
  "${OLLAMA_MODEL_REASONING:-qwen2.5:7b}"
  "${OLLAMA_MODEL_CODER:-qwen2.5-coder:7b}"
  "${OLLAMA_MODEL_FAST:-gemma4:2b}"
  "${OLLAMA_MODEL_EMBEDDING:-nomic-embed-text}"
)

dedupe_required_models() {
  local -A seen=()
  local deduped=()
  local model

  for model in "${REQUIRED_MODELS[@]}"; do
    [[ -z "$model" ]] && continue
    if [[ -z "${seen[$model]+x}" ]]; then
      deduped+=("$model")
      seen["$model"]=1
    fi
  done

  REQUIRED_MODELS=("${deduped[@]}")
}

dedupe_required_models

list_missing() {
  local tags
  tags="$(ollama list 2>/dev/null | awk 'NR>1 {print $1}' || true)"

  has_model_tag() {
    local wanted="$1"
    if grep -Fxq "$wanted" <<<"$tags"; then
      return 0
    fi

    if [[ "$wanted" != *:* ]] && grep -Fxq "${wanted}:latest" <<<"$tags"; then
      return 0
    fi

    return 1
  }

  for model in "${REQUIRED_MODELS[@]}"; do
    if ! has_model_tag "$model"; then
      echo "$model"
    fi
  done
}

ensure_ollama() {
  if has_cmd ollama; then
    return 0
  fi

  warn "Ollama CLI not found."
  if [[ "${1:-}" == "--install" ]]; then
    if internet_available; then
      log "Installing Ollama using official install script."
      curl -fsSL https://ollama.com/install.sh | sh
    else
      err "Cannot install Ollama without internet."
      return 1
    fi
  else
    return 1
  fi
}

ollama_api_ready() {
  curl -sS -m 3 http://127.0.0.1:11434/api/tags >/dev/null 2>&1
}

ensure_ollama_running() {
  if ollama_api_ready; then
    return 0
  fi

  warn "Ollama server is not running. Starting local daemon with 'ollama serve'."
  nohup ollama serve > "$LOG_DIR/ollama.log" 2>&1 &

  local waited=0
  while [[ "$waited" -lt 20 ]]; do
    if ollama_api_ready; then
      log "Ollama server is ready."
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done

  err "Ollama server did not become ready. Check $LOG_DIR/ollama.log"
  return 1
}

pull_missing() {
  local missing=()
  while IFS= read -r model; do
    [[ -n "$model" ]] && missing+=("$model")
  done < <(list_missing)

  if [[ "${#missing[@]}" -eq 0 ]]; then
    log "All required models are available."
    return 0
  fi

  if ! internet_available; then
    warn "No internet detected. Skipping model pulls. Missing: ${missing[*]}"
    return 0
  fi

  for model in "${missing[@]}"; do
    log "Pulling model: $model"
    ollama pull "$model"
  done
}

pull_model_tag() {
  local model_tag="$1"

  if [[ -z "$model_tag" ]]; then
    err "Model tag is required for pull-model"
    exit 2
  fi

  log "Pulling explicit model tag: $model_tag"
  ollama pull "$model_tag"
}

case "${1:-status}" in
  ensure)
    if ensure_ollama "${2:-}"; then
      log "Ollama CLI available."
    else
      err "Ollama not available."
      exit 1
    fi
    ;;
  status)
    if ! ensure_ollama; then
      err "Ollama not available."
      exit 1
    fi
    ensure_ollama_running
    log "Required models: ${REQUIRED_MODELS[*]}"
    missing="$(list_missing || true)"
    if [[ -z "$missing" ]]; then
      log "Model status: OK"
    else
      warn "Missing models:"
      echo "$missing"
    fi
    ;;
  pull)
    ensure_ollama "${2:-}"
    ensure_ollama_running
    pull_missing
    ;;
  pull-model)
    model_tag="${2:-}"
    install_flag="${3:-}"
    ensure_ollama "$install_flag"
    ensure_ollama_running
    pull_model_tag "$model_tag"
    ;;
  *)
    echo "Usage: $0 {ensure [--install]|status|pull [--install]|pull-model <model_tag> [--install]}"
    exit 2
    ;;
esac
