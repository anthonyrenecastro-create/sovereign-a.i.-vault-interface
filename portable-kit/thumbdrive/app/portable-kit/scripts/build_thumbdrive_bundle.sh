#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

OUT_DIR="$KIT_DIR/thumbdrive"
KNOWLEDGE_SRC=""
MODEL_SRC="${HOME}/.ollama/models"
REQUIRE_MODEL_GB=20
SKIP_MODEL=0

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --output <path>          Output folder for thumb-drive bundle (default: $KIT_DIR/thumbdrive)
  --knowledge-source <p>   Path to documents/knowledge pack to copy into data/documents
  --model-source <path>    Path to Ollama model store to embed (default: $HOME/.ollama/models)
  --require-model-gb <n>   Minimum model payload size in GB (default: 20)
  --skip-model             Do not copy model payload
EOF
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --output)
      OUT_DIR="$2"
      shift 2
      ;;
    --knowledge-source)
      KNOWLEDGE_SRC="$2"
      shift 2
      ;;
    --model-source)
      MODEL_SRC="$2"
      shift 2
      ;;
    --require-model-gb)
      REQUIRE_MODEL_GB="$2"
      shift 2
      ;;
    --skip-model)
      SKIP_MODEL=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      err "Unknown argument: $1"
      usage
      exit 2
      ;;
  esac
done

log "Building thumb-drive bundle at $OUT_DIR"

mkdir -p "$OUT_DIR"
mkdir -p "$OUT_DIR/app" \
  "$OUT_DIR/models" \
  "$OUT_DIR/data/system" \
  "$OUT_DIR/data/vector" \
  "$OUT_DIR/data/documents" \
  "$OUT_DIR/data/conversations" \
  "$OUT_DIR/data/exports" \
  "$OUT_DIR/data/logs" \
  "$OUT_DIR/cache/runtime" \
  "$OUT_DIR/cache/tmp" \
  "$OUT_DIR/cache/pids"

log "Syncing full app into bundle"
rsync -av --delete \
  --exclude '.git' \
  --exclude '.venv' \
  --exclude 'backend/.venv' \
  --exclude '**/__pycache__' \
  --exclude '*.pyc' \
  --exclude 'frontend/node_modules' \
  --exclude 'frontend/dist' \
  --exclude 'extracted' \
  --exclude 'portable-kit/thumbdrive' \
  --exclude 'portable-kit/thumbdrive-template' \
  "$REPO_DIR/" "$OUT_DIR/app/"

if [[ -n "$KNOWLEDGE_SRC" ]]; then
  if [[ ! -d "$KNOWLEDGE_SRC" && ! -f "$KNOWLEDGE_SRC" ]]; then
    err "Knowledge source not found: $KNOWLEDGE_SRC"
    exit 1
  fi

  log "Copying knowledge payload from $KNOWLEDGE_SRC"
  if [[ -d "$KNOWLEDGE_SRC" ]]; then
    rsync -av "$KNOWLEDGE_SRC/" "$OUT_DIR/data/documents/"
  else
    cp "$KNOWLEDGE_SRC" "$OUT_DIR/data/documents/"
  fi
else
  if [[ -d "$REPO_DIR/extracted" ]]; then
    log "Auto-seeding extracted knowledge sources (documents only, not runtime app code)"
    mkdir -p "$OUT_DIR/data/documents/source-extracted"
    rsync -av "$REPO_DIR/extracted/" "$OUT_DIR/data/documents/source-extracted/"
  fi

  if compgen -G "$REPO_DIR/*.zip" > /dev/null; then
    log "Auto-seeding ZIP source archives"
    mkdir -p "$OUT_DIR/data/documents/source-archives"
    cp "$REPO_DIR"/*.zip "$OUT_DIR/data/documents/source-archives/"
  fi
fi

MODEL_SIZE_GB=0
MODEL_STATUS="missing"
if [[ "$SKIP_MODEL" == "0" ]]; then
  if [[ ! -d "$MODEL_SRC" ]]; then
    err "Model source not found: $MODEL_SRC"
    err "Provide --model-source <path>, use --skip-model, or import a pre-zipped model archive with:"
    err "  $KIT_DIR/scripts/import_model_archive.sh --require-gb $REQUIRE_MODEL_GB"
    exit 1
  fi

  log "Copying Ollama models from $MODEL_SRC"
  rsync -av "$MODEL_SRC/" "$OUT_DIR/models/ollama-models/"

  MODEL_SIZE_GB="$(du -sBG "$OUT_DIR/models/ollama-models" | awk '{gsub("G","",$1); print $1}')"
  if [[ "$MODEL_SIZE_GB" -lt "$REQUIRE_MODEL_GB" ]]; then
    err "Model payload is ${MODEL_SIZE_GB}GB, below required ${REQUIRE_MODEL_GB}GB"
    exit 1
  fi
  MODEL_STATUS="ok"
else
  warn "Skipping model payload copy"
  cat > "$OUT_DIR/models/MODEL_PAYLOAD_REQUIRED.txt" <<EOF
Ollama model payload is not present in this bundle.

Target requirement: ${REQUIRE_MODEL_GB}GB model package.

To include model payload, rebuild with:
./portable-kit/scripts/build_thumbdrive_bundle.sh --model-source <ollama-model-path> --require-model-gb ${REQUIRE_MODEL_GB}
EOF
fi

cat > "$OUT_DIR/manifest.txt" <<EOF
bundle_built_at=$(date -Iseconds)
repo_source=$REPO_DIR
app_path=$OUT_DIR/app
models_path=$OUT_DIR/models
system_data_path=$OUT_DIR/data/system
vector_data_path=$OUT_DIR/data/vector
documents_path=$OUT_DIR/data/documents
conversations_path=$OUT_DIR/data/conversations
exports_path=$OUT_DIR/data/exports
logs_path=$OUT_DIR/data/logs
cache_path=$OUT_DIR/cache
model_size_gb=$MODEL_SIZE_GB
model_status=$MODEL_STATUS
EOF

log "Thumb-drive bundle complete"
log "Manifest: $OUT_DIR/manifest.txt"
