#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"
load_runtime_env

REQUIRED_MODELS=(
  "${OLLAMA_MODEL_DEFAULT:-llama3.1:8b}"
  "${OLLAMA_MODEL_REASONING:-llama3.1:8b}"
  "${OLLAMA_MODEL_CODER:-qwen2.5-coder:7b}"
  "${OLLAMA_MODEL_FAST:-gemma2:2b}"
  "${OLLAMA_MODEL_EMBEDDING:-nomic-embed-text}"
)

list_missing() {
  local tags
  tags="$(ollama list 2>/dev/null || true)"
  for model in "${REQUIRED_MODELS[@]}"; do
    if ! grep -q "$model" <<<"$tags"; then
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
    pull_missing
    ;;
  *)
    echo "Usage: $0 {ensure [--install]|status|pull [--install]}"
    exit 2
    ;;
esac
