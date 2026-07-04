#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$EXPORT_DIR/sovereign-vault-node-$STAMP.tgz"

log "Creating replication bundle: $OUT"

tar -czf "$OUT" \
  -C "$REPO_DIR" backend frontend portable-kit \
  --exclude='frontend/node_modules' \
  --exclude='frontend/dist' \
  --exclude='backend/.venv' \
  --exclude='.git'

log "Bundle ready: $OUT"
