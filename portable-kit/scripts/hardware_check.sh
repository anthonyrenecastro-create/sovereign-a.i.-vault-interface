#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/common.sh"

CPU_CORES="$(get_cpu_cores)"
MEM_GB="$(get_mem_gb)"
DISK_FREE_GB="$(get_disk_free_gb)"
MIN_MODE="$(get_min_mode "$MEM_GB")"
HW_TIER="$(detect_hw_tier "$MEM_GB" "$CPU_CORES")"

cat <<EOF
{
  "cpu_cores": $CPU_CORES,
  "memory_gb": $MEM_GB,
  "disk_free_gb": ${DISK_FREE_GB:-0},
  "hardware_tier": "$HW_TIER",
  "minimum_memory_mode": $MIN_MODE,
  "recommendation": "$( [[ "$HW_TIER" == "high-compute" ]] && echo "High-compute profile enabled." || echo "Micro-PC profile enabled." )"
}
EOF
