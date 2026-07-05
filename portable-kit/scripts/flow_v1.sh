#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

COMMAND="${1:-help}"
if [[ "$#" -gt 0 ]]; then
  shift
fi

BUNDLE_DIR="/tmp/sovereign-thumbdrive"
EXPORT_DIR="/tmp"
TARGET_DIR="/tmp/sovereign-thumbdrive-target"
ARCHIVE_PATH=""
REQUIRE_MODEL_GB=1
MODEL_SOURCE="${HOME}/.ollama/models"
SKIP_MODEL_BUILD=0
NO_BROWSER=1

usage() {
  cat <<EOF
Usage: $0 <command> [options]

Commands:
  build       Build deterministic thumbdrive bundle
  verify      Verify bundle or archive integrity
  export      Export bundle to single archive
  deploy      Verify + deploy archive to target
  launch      Launch source runtime services (portable-kit/scripts/launch.sh)
  runtime     Validate runtime ports (8000/5173/11434)
  ollama      Validate Ollama path with a tiny prompt
  retrieval   Validate retrieval index+search path
  full        Run build -> verify -> export -> deploy -> runtime

Options:
  --bundle-dir <path>      Bundle directory (default: $BUNDLE_DIR)
  --export-dir <path>      Archive output directory (default: $EXPORT_DIR)
  --target-dir <path>      Deploy target directory (default: $TARGET_DIR)
  --archive <path>         Archive path (defaults to latest in --export-dir)
  --require-model-gb <n>   Required model payload size GB (default: $REQUIRE_MODEL_GB)
  --model-source <path>    Ollama model source path for build (default: $MODEL_SOURCE)
  --skip-model-build       Build without model payload copy
  --no-browser             Do not open browser during launch (default: on)
  -h, --help               Show this help

Examples:
  $0 full --require-model-gb 12
  $0 build --bundle-dir /tmp/sovereign-thumbdrive --model-source ~/.ollama/models --require-model-gb 12
  $0 verify --bundle-dir /tmp/sovereign-thumbdrive --require-model-gb 12
EOF
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --bundle-dir)
      BUNDLE_DIR="$2"
      shift 2
      ;;
    --export-dir)
      EXPORT_DIR="$2"
      shift 2
      ;;
    --target-dir)
      TARGET_DIR="$2"
      shift 2
      ;;
    --archive)
      ARCHIVE_PATH="$2"
      shift 2
      ;;
    --require-model-gb)
      REQUIRE_MODEL_GB="$2"
      shift 2
      ;;
    --model-source)
      MODEL_SOURCE="$2"
      shift 2
      ;;
    --skip-model-build)
      SKIP_MODEL_BUILD=1
      shift
      ;;
    --no-browser)
      NO_BROWSER=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      err "Unknown option: $1"
      usage
      exit 2
      ;;
  esac
done

latest_archive() {
  find "$EXPORT_DIR" -maxdepth 1 -type f \( -name 'sovereign-thumbdrive-*.tar' -o -name 'sovereign-thumbdrive-*.tgz' -o -name 'sovereign-thumbdrive-*.tar.gz' \) -printf '%T@ %p\n' | sort -nr | awk 'NR==1{print $2}'
}

cmd_build() {
  local args=(--output "$BUNDLE_DIR" --require-model-gb "$REQUIRE_MODEL_GB")
  if [[ "$SKIP_MODEL_BUILD" == "1" ]]; then
    args+=(--skip-model)
  else
    args+=(--model-source "$MODEL_SOURCE")
  fi
  "$SCRIPT_DIR/build_thumbdrive_bundle.sh" "${args[@]}"
}

cmd_verify() {
  "$SCRIPT_DIR/verify_thumbdrive_bundle.sh" --bundle-dir "$BUNDLE_DIR" --require-model-gb "$REQUIRE_MODEL_GB" --require-models
}

cmd_export() {
  "$SCRIPT_DIR/replicate_export.sh" thumbdrive --source "$BUNDLE_DIR" --output-dir "$EXPORT_DIR"
}

cmd_deploy() {
  local archive="$ARCHIVE_PATH"
  if [[ -z "$archive" ]]; then
    archive="$(latest_archive || true)"
  fi
  if [[ -z "$archive" ]]; then
    err "No archive found. Run export first or provide --archive <path>."
    exit 1
  fi
  "$SCRIPT_DIR/deploy_from_thumbdrive_archive.sh" --archive "$archive" --target "$TARGET_DIR" --no-launch --clean-target --require-model-gb "$REQUIRE_MODEL_GB"
}

cmd_launch() {
  if [[ "$NO_BROWSER" == "1" ]]; then
    BROWSER=true "$SCRIPT_DIR/launch.sh"
  else
    "$SCRIPT_DIR/launch.sh"
  fi
}

cmd_runtime() {
  ss -ltnp | grep -E ':8000|:5173|:11434' || true
  curl -sS http://127.0.0.1:8000/api/health >/dev/null
  curl -sS http://127.0.0.1:5173/api/health >/dev/null
  curl -sS http://127.0.0.1:11434/api/tags >/dev/null
  log "Runtime validation passed (8000/5173/11434)"
}

cmd_ollama() {
  local model
  model="$(awk -F= '/^OLLAMA_MODEL_DEFAULT=/{print $2}' "$ENV_FILE" 2>/dev/null || true)"
  [[ -z "$model" ]] && model="gemma3:1b"
  printf 'health check\n' | ollama run "$model" >/dev/null
  log "Ollama path validation passed with model: $model"
}

cmd_retrieval() {
  local title="v1-retrieval-smoke-$(date +%s)"
  curl -sS -X POST http://127.0.0.1:8000/api/index/document \
    -H 'Content-Type: application/json' \
    -d "{\"title\":\"$title\",\"content\":\"retrieval smoke document\",\"source_type\":\"manual\",\"source_id\":\"v1-smoke\"}" >/dev/null
  local out
  out="$(curl -sS -X POST http://127.0.0.1:8000/api/index/search -H 'Content-Type: application/json' -d '{"query":"retrieval smoke document","mode":"semantic","top_k":5}')"
  if ! grep -q '"count"' <<<"$out"; then
    err "Retrieval path validation failed"
    exit 1
  fi
  log "Retrieval path validation passed"
}

case "$COMMAND" in
  build)
    cmd_build
    ;;
  verify)
    cmd_verify
    ;;
  export)
    cmd_export
    ;;
  deploy)
    cmd_deploy
    ;;
  launch)
    cmd_launch
    ;;
  runtime)
    cmd_runtime
    ;;
  ollama)
    cmd_ollama
    ;;
  retrieval)
    cmd_retrieval
    ;;
  full)
    cmd_build
    cmd_verify
    cmd_export
    cmd_deploy
    cmd_runtime
    ;;
  help|""|*)
    usage
    if [[ "$COMMAND" != "help" && "$COMMAND" != "" ]]; then
      exit 2
    fi
    ;;
esac
