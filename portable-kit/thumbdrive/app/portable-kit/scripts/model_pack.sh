#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

OLLAMA_STORE_DEFAULT="$HOME/.ollama/models"
PACK_DIR="$MODEL_CACHE_DIR/ollama-models"

usage() {
  echo "Usage: $0 {export|import} [--source <path>] [--dest <path>]"
}

ACTION="${1:-}"
shift || true

SRC="$OLLAMA_STORE_DEFAULT"
DST="$PACK_DIR"

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --source)
      SRC="$2"
      shift 2
      ;;
    --dest)
      DST="$2"
      shift 2
      ;;
    *)
      usage
      exit 2
      ;;
  esac
done

case "$ACTION" in
  export)
    if [[ ! -d "$SRC" ]]; then
      err "Source model store not found: $SRC"
      exit 1
    fi
    mkdir -p "$DST"
    log "Exporting Ollama model store from $SRC to $DST"
    rsync -av "$SRC/" "$DST/"
    log "Model export complete"
    ;;
  import)
    if [[ ! -d "$SRC" ]]; then
      err "Import source not found: $SRC"
      exit 1
    fi
    mkdir -p "$DST"
    log "Importing Ollama model store from $SRC to $DST"
    rsync -av "$SRC/" "$DST/"
    log "Model import complete"
    ;;
  *)
    usage
    exit 2
    ;;
esac
