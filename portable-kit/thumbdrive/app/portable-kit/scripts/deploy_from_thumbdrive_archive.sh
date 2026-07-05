#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ARCHIVE_PATH=""
TARGET_ROOT="${HOME}/sovereign-thumbdrive-node"
REQUIRE_MODEL_GB=1
VERIFY_MODELS=1
EXTRACT_ONLY=0
NO_LAUNCH=0
INSTALL_OLLAMA=0
SKIP_MODEL_PULL=1
NO_BROWSER=0
CLEAN_TARGET=0

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --archive <path>         Thumbdrive archive (.tar/.tgz/.tar.gz) to deploy
  --target <path>          Extraction target root (default: $TARGET_ROOT)
  --require-model-gb <n>   Minimum model payload size in GB for verification (default: $REQUIRE_MODEL_GB)
  --skip-model-verify      Verify structure only, do not require model payload
  --extract-only           Verify + extract only; do not bootstrap/launch
  --no-launch              Verify + extract + bootstrap, but do not launch services
  --install-ollama         Allow bootstrap to install Ollama if missing and online
  --allow-model-pull       Allow bootstrap model pulls (default is skip pulls)
  --no-browser             Prevent browser open on launch
  --clean-target           Remove existing target contents before extract
  -h, --help               Show help

Examples:
  $0 --archive /tmp/sovereign-thumbdrive-YYYYMMDD-HHMMSS.tar --target ~/sovereign-node --extract-only
  $0 --archive /tmp/sovereign-thumbdrive-YYYYMMDD-HHMMSS.tar --target ~/sovereign-node --no-browser
EOF
}

pick_latest_archive() {
  local latest
  latest="$(find /tmp -maxdepth 1 -type f \( -name 'sovereign-thumbdrive-*.tar' -o -name 'sovereign-thumbdrive-*.tgz' -o -name 'sovereign-thumbdrive-*.tar.gz' \) -printf '%T@ %p\n' | sort -nr | awk 'NR==1{print $2}')"
  if [[ -n "$latest" ]]; then
    echo "$latest"
    return 0
  fi
  return 1
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --archive)
      ARCHIVE_PATH="$2"
      shift 2
      ;;
    --target)
      TARGET_ROOT="$2"
      shift 2
      ;;
    --require-model-gb)
      REQUIRE_MODEL_GB="$2"
      shift 2
      ;;
    --skip-model-verify)
      VERIFY_MODELS=0
      shift
      ;;
    --extract-only)
      EXTRACT_ONLY=1
      shift
      ;;
    --no-launch)
      NO_LAUNCH=1
      shift
      ;;
    --install-ollama)
      INSTALL_OLLAMA=1
      shift
      ;;
    --allow-model-pull)
      SKIP_MODEL_PULL=0
      shift
      ;;
    --no-browser)
      NO_BROWSER=1
      shift
      ;;
    --clean-target)
      CLEAN_TARGET=1
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

if [[ -z "$ARCHIVE_PATH" ]]; then
  ARCHIVE_PATH="$(pick_latest_archive || true)"
fi

if [[ -z "$ARCHIVE_PATH" ]]; then
  err "No archive provided and no matching sovereign-thumbdrive archive found in /tmp"
  exit 1
fi

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  err "Archive not found: $ARCHIVE_PATH"
  exit 1
fi

VERIFY_CMD=("$SCRIPT_DIR/verify_thumbdrive_bundle.sh" --archive "$ARCHIVE_PATH" --require-model-gb "$REQUIRE_MODEL_GB")
if [[ "$VERIFY_MODELS" == "1" ]]; then
  VERIFY_CMD+=(--require-models)
fi

log "Verifying archive: $ARCHIVE_PATH"
"${VERIFY_CMD[@]}"

log "Preparing target: $TARGET_ROOT"
mkdir -p "$TARGET_ROOT"

if [[ "$CLEAN_TARGET" == "1" ]]; then
  log "Cleaning target contents"
  find "$TARGET_ROOT" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
fi

log "Extracting archive into target"
tar -xf "$ARCHIVE_PATH" -C "$TARGET_ROOT"

if [[ "$EXTRACT_ONLY" == "1" ]]; then
  log "Extract-only complete"
  log "Bundle root: $TARGET_ROOT"
  log "Next: $TARGET_ROOT/app/portable-kit/scripts/bootstrap.sh --skip-model-pull"
  exit 0
fi

BOOTSTRAP="$TARGET_ROOT/app/portable-kit/scripts/bootstrap.sh"
LAUNCH="$TARGET_ROOT/app/portable-kit/scripts/launch.sh"

if [[ ! -x "$BOOTSTRAP" || ! -x "$LAUNCH" ]]; then
  err "Expected scripts missing after extract"
  err "Missing bootstrap or launch under: $TARGET_ROOT/app/portable-kit/scripts"
  exit 1
fi

BOOTSTRAP_ARGS=()
if [[ "$INSTALL_OLLAMA" == "1" ]]; then
  BOOTSTRAP_ARGS+=(--install-ollama)
fi
if [[ "$SKIP_MODEL_PULL" == "1" ]]; then
  BOOTSTRAP_ARGS+=(--skip-model-pull)
fi

log "Running bootstrap"
"$BOOTSTRAP" "${BOOTSTRAP_ARGS[@]}"

if [[ "$NO_LAUNCH" == "1" ]]; then
  log "Bootstrap complete; launch skipped by request"
  log "Launch manually: $LAUNCH"
  exit 0
fi

log "Launching services"
if [[ "$NO_BROWSER" == "1" ]]; then
  BROWSER=true "$LAUNCH"
else
  "$LAUNCH"
fi

log "Deployment complete"
