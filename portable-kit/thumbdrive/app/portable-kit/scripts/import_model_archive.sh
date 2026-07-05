#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

ARCHIVE_PATH=""
ARCHIVE_DIR="$KIT_DIR/model-archives"
DEST_DIR="$KIT_DIR/thumbdrive/models/ollama-models"
REQUIRE_GB=20
ARCHIVE_DIR_EXPLICIT=0
SOURCE_DIR=""
LINK_MODE="auto"

usage() {
  cat <<EOF
Usage: $0 [options]

Options:
  --archive <path>      Path to model archive file (.zip, .tar, .tgz, .tar.gz, .tar.xz)
  --source-dir <path>   Import directly from an existing model store directory
  --archive-dir <path>  Folder to scan when --archive is omitted (default: $ARCHIVE_DIR)
  --dest <path>         Destination model folder (default: $DEST_DIR)
  --require-gb <n>      Minimum unpacked payload size in GB (default: $REQUIRE_GB)
  --link-mode <mode>    For --source-dir: auto|always|never (default: auto)

Behavior:
  - If --source-dir is provided, imports directly from that directory.
  - Otherwise, if --archive is omitted, the script auto-selects the newest supported archive
    from --archive-dir, then from repo root.
  - Archive is unpacked into <dest> and validated against --require-gb.
EOF
}

same_filesystem() {
  local a="$1"
  local b="$2"
  [[ "$(df -P "$a" | awk 'NR==2 {print $1}')" == "$(df -P "$b" | awk 'NR==2 {print $1}')" ]]
}

has_supported_ext() {
  local file="$1"
  case "$file" in
    *.zip|*.tar|*.tgz|*.tar.gz|*.tar.xz)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

pick_latest_archive() {
  local scan_dir="$1"
  if [[ ! -d "$scan_dir" ]]; then
    return 1
  fi

  local latest=""
  latest="$(find "$scan_dir" -maxdepth 1 -type f \( -iname '*model*.zip' -o -iname '*model*.tar' -o -iname '*model*.tgz' -o -iname '*model*.tar.gz' -o -iname '*model*.tar.xz' -o -iname '*ollama*.zip' -o -iname '*ollama*.tar' -o -iname '*ollama*.tgz' -o -iname '*ollama*.tar.gz' -o -iname '*ollama*.tar.xz' \) -printf '%T@ %p\n' | sort -nr | awk 'NR==1{print $2}')"
  if [[ -z "$latest" ]]; then
    latest="$(find "$scan_dir" -maxdepth 1 -type f \( -name '*.zip' -o -name '*.tar' -o -name '*.tgz' -o -name '*.tar.gz' -o -name '*.tar.xz' \) -printf '%T@ %p\n' | sort -nr | awk 'NR==1{print $2}')"
  fi
  if [[ -n "$latest" ]]; then
    echo "$latest"
    return 0
  fi

  return 1
}

extract_archive() {
  local archive="$1"
  local dest="$2"

  mkdir -p "$dest"

  case "$archive" in
    *.zip)
      if ! has_cmd unzip; then
        err "unzip is required to extract .zip archives"
        exit 1
      fi
      unzip -o "$archive" -d "$dest"
      ;;
    *.tar)
      tar -xf "$archive" -C "$dest"
      ;;
    *.tgz|*.tar.gz)
      tar -xzf "$archive" -C "$dest"
      ;;
    *.tar.xz)
      tar -xJf "$archive" -C "$dest"
      ;;
    *)
      err "Unsupported archive type: $archive"
      exit 1
      ;;
  esac
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --archive)
      ARCHIVE_PATH="$2"
      shift 2
      ;;
    --source-dir)
      SOURCE_DIR="$2"
      shift 2
      ;;
    --archive-dir)
      ARCHIVE_DIR="$2"
      ARCHIVE_DIR_EXPLICIT=1
      shift 2
      ;;
    --dest)
      DEST_DIR="$2"
      shift 2
      ;;
    --require-gb)
      REQUIRE_GB="$2"
      shift 2
      ;;
    --link-mode)
      LINK_MODE="$2"
      shift 2
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

if [[ -n "$SOURCE_DIR" ]]; then
  if [[ ! -d "$SOURCE_DIR" ]]; then
    err "Source model directory not found: $SOURCE_DIR"
    exit 1
  fi

  log "Using source model directory: $SOURCE_DIR"
  log "Destination: $DEST_DIR"
  mkdir -p "$DEST_DIR"
  find "$DEST_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +

  use_links=0
  case "$LINK_MODE" in
    always)
      use_links=1
      ;;
    never)
      use_links=0
      ;;
    auto)
      if same_filesystem "$SOURCE_DIR" "$DEST_DIR"; then
        use_links=1
      fi
      ;;
    *)
      err "Invalid --link-mode: $LINK_MODE (use auto|always|never)"
      exit 2
      ;;
  esac

  if [[ "$use_links" == "1" ]]; then
    log "Importing via hardlinks to reduce disk usage"
    cp -al "$SOURCE_DIR/." "$DEST_DIR/"
  else
    log "Importing via rsync copy"
    rsync -a "$SOURCE_DIR/" "$DEST_DIR/"
  fi

  UNPACKED_SIZE_GB="$(du -sBG "$DEST_DIR" | awk '{gsub("G","",$1); print $1}')"
  if [[ "$UNPACKED_SIZE_GB" -lt "$REQUIRE_GB" ]]; then
    err "Imported model payload is ${UNPACKED_SIZE_GB}GB, below required ${REQUIRE_GB}GB"
    exit 1
  fi

  cat > "$KIT_DIR/thumbdrive/models/IMPORT_STATUS.txt" <<EOF
archive_source=source-dir:$SOURCE_DIR
imported_at=$(date -Iseconds)
destination=$DEST_DIR
unpacked_size_gb=$UNPACKED_SIZE_GB
require_gb=$REQUIRE_GB
status=ok
EOF

  rm -f "$KIT_DIR/thumbdrive/models/MODEL_PAYLOAD_REQUIRED.txt"

  log "Model directory import complete"
  log "Imported size: ${UNPACKED_SIZE_GB}GB"
  log "Status file: $KIT_DIR/thumbdrive/models/IMPORT_STATUS.txt"
  exit 0
fi

if [[ -z "$ARCHIVE_PATH" ]]; then
  ARCHIVE_PATH="$(pick_latest_archive "$ARCHIVE_DIR" || true)"
fi

if [[ -z "$ARCHIVE_PATH" && "$ARCHIVE_DIR_EXPLICIT" == "0" ]]; then
  ARCHIVE_PATH="$(pick_latest_archive "$REPO_DIR" || true)"
fi

if [[ -z "$ARCHIVE_PATH" ]]; then
  if [[ -f "$ARCHIVE_DIR/.gitkeep" ]]; then
    keep_hint="$(tr -d '[:space:]' < "$ARCHIVE_DIR/.gitkeep" || true)"
    if [[ -n "$keep_hint" ]]; then
      err "Detected text in $ARCHIVE_DIR/.gitkeep ('$keep_hint')."
      err "That file is a placeholder only; copy the real archive file into $ARCHIVE_DIR."
    fi
  fi
  err "No model archive found. Drop one into $ARCHIVE_DIR or provide --archive <path>."
  exit 1
fi

if [[ ! -f "$ARCHIVE_PATH" ]]; then
  err "Archive not found: $ARCHIVE_PATH"
  exit 1
fi

if ! has_supported_ext "$ARCHIVE_PATH"; then
  err "Unsupported archive extension: $ARCHIVE_PATH"
  exit 1
fi

log "Using model archive: $ARCHIVE_PATH"
log "Destination: $DEST_DIR"

mkdir -p "$DEST_DIR"
find "$DEST_DIR" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
extract_archive "$ARCHIVE_PATH" "$DEST_DIR"

UNPACKED_SIZE_GB="$(du -sBG "$DEST_DIR" | awk '{gsub("G","",$1); print $1}')"
if [[ "$UNPACKED_SIZE_GB" -lt "$REQUIRE_GB" ]]; then
  err "Unpacked model payload is ${UNPACKED_SIZE_GB}GB, below required ${REQUIRE_GB}GB"
  err "Archive does not appear to be the full Ollama model payload."
  err "Drop a model-specific archive into $ARCHIVE_DIR and re-run."
  exit 1
fi

cat > "$KIT_DIR/thumbdrive/models/IMPORT_STATUS.txt" <<EOF
archive_source=$ARCHIVE_PATH
imported_at=$(date -Iseconds)
destination=$DEST_DIR
unpacked_size_gb=$UNPACKED_SIZE_GB
require_gb=$REQUIRE_GB
status=ok
EOF

rm -f "$KIT_DIR/thumbdrive/models/MODEL_PAYLOAD_REQUIRED.txt"

log "Model archive import complete"
log "Unpacked size: ${UNPACKED_SIZE_GB}GB"
log "Status file: $KIT_DIR/thumbdrive/models/IMPORT_STATUS.txt"
