#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

WORKSPACES=(. client server)

log() {
  echo -e "$1"
}

remove_if_exists() {
  local path="$1"
  if [ -e "$path" ]; then
    rm -rf "$path"
    log "  removed: $path"
  fi
}

remove_group() {
  local label="$1"
  local suffix="$2"

  log "- $label"

  for ws in "${WORKSPACES[@]}"; do
    if [ "$ws" = "." ]; then
      remove_if_exists "$suffix"
    else
      remove_if_exists "$ws/$suffix"
    fi
  done
}

log "# Cleaning project..."

remove_group "Removing node_modules" "node_modules"
remove_group "Removing lock files" "package-lock.json"

log ""
log "Cleaning npm cache..."
npm cache clean --force > /dev/null 2>&1

log ""
log "Clean completed successfully."
