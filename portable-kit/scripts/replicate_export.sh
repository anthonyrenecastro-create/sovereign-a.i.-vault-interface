#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

MODE="repo"
SOURCE_DIR=""
OUT_DIR="$EXPORT_DIR"
COMPRESS=0

usage() {
  cat <<EOF
Usage: $0 [repo|thumbdrive] [options]

Modes:
  repo (default)      Export repository payload (backend/frontend/portable-kit)
  thumbdrive          Export an existing thumbdrive bundle directory as one archive

Options:
  --source <path>     Source directory for thumbdrive mode (default: portable-kit/thumbdrive)
  --output-dir <path> Archive output directory (default: $EXPORT_DIR)
  --compress          Create .tgz (gzip) instead of .tar
  -h, --help          Show this help
EOF
}

if [[ "${1:-}" == "repo" || "${1:-}" == "thumbdrive" ]]; then
  MODE="$1"
  shift
fi

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --source)
      SOURCE_DIR="$2"
      shift 2
      ;;
    --output-dir)
      OUT_DIR="$2"
      shift 2
      ;;
    --compress)
      COMPRESS=1
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

mkdir -p "$OUT_DIR"

STAMP="$(date +%Y%m%d-%H%M%S)"

export_repo() {
  local out
  if [[ "$COMPRESS" == "1" ]]; then
    out="$OUT_DIR/sovereign-vault-node-$STAMP.tgz"
    log "Creating replication bundle: $out"
    tar -czf "$out" \
      -C "$REPO_DIR" backend frontend portable-kit \
      --exclude='frontend/node_modules' \
      --exclude='frontend/dist' \
      --exclude='backend/.venv' \
      --exclude='.git'
  else
    out="$OUT_DIR/sovereign-vault-node-$STAMP.tar"
    log "Creating replication bundle: $out"
    tar -cf "$out" \
      -C "$REPO_DIR" backend frontend portable-kit \
      --exclude='frontend/node_modules' \
      --exclude='frontend/dist' \
      --exclude='backend/.venv' \
      --exclude='.git'
  fi
  log "Bundle ready: $out"
}

export_thumbdrive() {
  local src out
  src="${SOURCE_DIR:-$KIT_DIR/thumbdrive}"
  if [[ ! -d "$src" ]]; then
    err "Thumbdrive source not found: $src"
    exit 1
  fi

  if [[ ! -f "$src/manifest.txt" ]]; then
    warn "No manifest found at $src/manifest.txt. Exporting anyway."
  fi

  if [[ "$COMPRESS" == "1" ]]; then
    out="$OUT_DIR/sovereign-thumbdrive-$STAMP.tgz"
    log "Creating thumbdrive archive: $out"
    tar -czf "$out" -C "$src" .
  else
    out="$OUT_DIR/sovereign-thumbdrive-$STAMP.tar"
    log "Creating thumbdrive archive: $out"
    tar -cf "$out" -C "$src" .
  fi
  log "Thumbdrive archive ready: $out"
}

case "$MODE" in
  repo)
    export_repo
    ;;
  thumbdrive)
    export_thumbdrive
    ;;
  *)
    err "Unknown mode: $MODE"
    usage
    exit 2
    ;;
esac
