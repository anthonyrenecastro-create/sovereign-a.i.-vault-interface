#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

BUNDLE_DIR=""
ARCHIVE_PATH=""
REQUIRE_MODEL_GB=1
REQUIRE_MODELS=0

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --bundle-dir <path>     Verify an existing thumbdrive bundle directory
  --archive <path>        Verify an exported .tar/.tgz/.tar.gz thumbdrive archive
  --require-model-gb <n>  Minimum model payload size in GB (default: $REQUIRE_MODEL_GB)
  --require-models        Require model payload to be present and marked ok
  -h, --help              Show help

Examples:
  $0 --bundle-dir /tmp/sovereign-thumbdrive --require-model-gb 12 --require-models
  $0 --archive /tmp/sovereign-thumbdrive-20260704-230631.tar --require-models
EOF
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --bundle-dir)
      BUNDLE_DIR="$2"
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
    --require-models)
      REQUIRE_MODELS=1
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

if [[ -n "$BUNDLE_DIR" && -n "$ARCHIVE_PATH" ]]; then
  err "Use either --bundle-dir or --archive, not both"
  exit 2
fi

if [[ -z "$BUNDLE_DIR" && -z "$ARCHIVE_PATH" ]]; then
  BUNDLE_DIR="$KIT_DIR/thumbdrive"
fi

require_paths=(
  "manifest.txt"
  "app"
  "models"
  "data"
  "cache"
)

manifest_model_status=""
manifest_model_size=""

read_manifest_from_file() {
  local f="$1"
  manifest_model_status="$(awk -F= '/^model_status=/{print $2}' "$f" | tail -n 1)"
  manifest_model_size="$(awk -F= '/^model_size_gb=/{print $2}' "$f" | tail -n 1)"
}

verify_manifest_values() {
  if [[ -z "$manifest_model_status" || -z "$manifest_model_size" ]]; then
    err "manifest.txt is missing model_status and/or model_size_gb"
    return 1
  fi

  if [[ "$REQUIRE_MODELS" == "1" && "$manifest_model_status" != "ok" ]]; then
    err "Model payload required, but manifest model_status=$manifest_model_status"
    return 1
  fi

  if [[ "$manifest_model_size" =~ ^[0-9]+$ ]]; then
    if [[ "$manifest_model_size" -lt "$REQUIRE_MODEL_GB" ]]; then
      err "Manifest model_size_gb=$manifest_model_size is below required $REQUIRE_MODEL_GB"
      return 1
    fi
  else
    err "manifest.txt has non-numeric model_size_gb: $manifest_model_size"
    return 1
  fi

  return 0
}

verify_bundle_dir() {
  local root="$1"
  if [[ ! -d "$root" ]]; then
    err "Bundle directory not found: $root"
    exit 1
  fi

  log "Verifying bundle directory: $root"

  local rel
  for rel in "${require_paths[@]}"; do
    if [[ ! -e "$root/$rel" ]]; then
      err "Missing required path: $root/$rel"
      exit 1
    fi
  done

  read_manifest_from_file "$root/manifest.txt"
  verify_manifest_values

  if [[ "$REQUIRE_MODELS" == "1" ]]; then
    if [[ ! -d "$root/models/ollama-models" ]]; then
      err "Model payload directory missing: $root/models/ollama-models"
      exit 1
    fi

    local actual_size
    actual_size="$(du -sBG "$root/models/ollama-models" | awk '{gsub("G","",$1); print $1}')"
    if [[ "$actual_size" -lt "$REQUIRE_MODEL_GB" ]]; then
      err "Actual model payload ${actual_size}GB is below required ${REQUIRE_MODEL_GB}GB"
      exit 1
    fi
  fi

  log "Bundle verification passed"
  log "model_status=$manifest_model_status model_size_gb=$manifest_model_size"
}

verify_archive() {
  local archive="$1"
  if [[ ! -f "$archive" ]]; then
    err "Archive not found: $archive"
    exit 1
  fi

  case "$archive" in
    *.tar|*.tgz|*.tar.gz)
      ;;
    *)
      err "Unsupported archive extension: $archive"
      exit 1
      ;;
  esac

  log "Verifying archive: $archive"

  local listing
  listing="$(tar -tf "$archive")"

  local rel
  for rel in "${require_paths[@]}"; do
    if ! grep -Eq "^(\./)?${rel}(/|$)" <<<"$listing"; then
      err "Archive missing required path: $rel"
      exit 1
    fi
  done

  local manifest_content
  manifest_content="$(tar -xOf "$archive" manifest.txt 2>/dev/null || tar -xOf "$archive" ./manifest.txt 2>/dev/null || true)"
  if [[ -z "$manifest_content" ]]; then
    err "Could not read manifest.txt from archive"
    exit 1
  fi

  manifest_model_status="$(awk -F= '/^model_status=/{print $2}' <<<"$manifest_content" | tail -n 1)"
  manifest_model_size="$(awk -F= '/^model_size_gb=/{print $2}' <<<"$manifest_content" | tail -n 1)"
  verify_manifest_values

  if [[ "$REQUIRE_MODELS" == "1" ]]; then
    if ! grep -Eq '^(\./)?models/ollama-models(/|$)' <<<"$listing"; then
      err "Archive missing model payload folder: models/ollama-models"
      exit 1
    fi
  fi

  log "Archive verification passed"
  log "model_status=$manifest_model_status model_size_gb=$manifest_model_size"
}

if [[ -n "$ARCHIVE_PATH" ]]; then
  verify_archive "$ARCHIVE_PATH"
else
  verify_bundle_dir "$BUNDLE_DIR"
fi
