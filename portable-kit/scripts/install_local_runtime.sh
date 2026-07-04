#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

TARGET_ROOT="${HOME}/sovereign-vault-node"
NO_LAUNCH=0
INSTALL_OLLAMA=0
SKIP_MODEL_PULL=0
NO_BROWSER=0

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --target)
      TARGET_ROOT="$2"
      shift 2
      ;;
    --no-launch)
      NO_LAUNCH=1
      shift
      ;;
    --install-ollama)
      INSTALL_OLLAMA=1
      shift
      ;;
    --skip-model-pull)
      SKIP_MODEL_PULL=1
      shift
      ;;
    --no-browser)
      NO_BROWSER=1
      shift
      ;;
    *)
      err "Unknown option: $1"
      exit 2
      ;;
  esac
done

log "Installing local runtime node"
log "Source (USB/package): $REPO_DIR"
log "Target (SSD runtime): $TARGET_ROOT"

mkdir -p "$TARGET_ROOT"

rsync -av --delete \
  --exclude '.git' \
  --exclude 'frontend/node_modules' \
  --exclude 'frontend/dist' \
  --exclude 'backend/.venv' \
  --exclude 'extracted' \
  --exclude '*.zip' \
  "$REPO_DIR/" "$TARGET_ROOT/"

mkdir -p "$TARGET_ROOT/portable-kit/runtime"
cat > "$TARGET_ROOT/portable-kit/runtime/source.info" <<EOF
source_usb_path=$REPO_DIR
installed_at=$(date -Iseconds)
EOF

INSTALLER="$TARGET_ROOT/portable-kit/scripts/field_installer.sh"
ARGS=()
if [[ "$INSTALL_OLLAMA" == "1" ]]; then
  ARGS+=("--install-ollama")
fi
if [[ "$SKIP_MODEL_PULL" == "1" ]]; then
  ARGS+=("--skip-model-pull")
fi
if [[ "$NO_BROWSER" == "1" ]]; then
  ARGS+=("--no-browser")
fi

if [[ "$NO_LAUNCH" == "1" ]]; then
  log "Running bootstrap only on target node"
  BOOTSTRAP="$TARGET_ROOT/portable-kit/scripts/bootstrap.sh"
  "$BOOTSTRAP" "${ARGS[@]}"
  log "Bootstrap complete. Launch manually: $TARGET_ROOT/portable-kit/scripts/launch.sh"
else
  log "Running full field installer on target node"
  "$INSTALLER" "${ARGS[@]}"
fi

log "Local runtime install complete"
log "Node path: $TARGET_ROOT"
