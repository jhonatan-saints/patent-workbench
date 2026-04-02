#!/usr/bin/env bash
set -euo pipefail

REQUIRED_MAJOR=24

echo "# Checking Node version..."

if ! command -v node > /dev/null 2>&1; then
  echo "Error: node is not installed or not in PATH"
  exit 1
fi

NODE_VER=$(node -v | sed 's/^v//')
NODE_MAJOR=$(echo "$NODE_VER" | cut -d. -f1)

if [[ "$NODE_MAJOR" -ne "$REQUIRED_MAJOR" ]]; then
  echo "Error: detected node version $NODE_VER but required is ${REQUIRED_MAJOR}.x"
  echo "Run: nvm use ${REQUIRED_MAJOR}"
  exit 1
fi

echo "Node version OK: $NODE_VER"

echo
echo "Installing dependencies (workspaces)..."
npm install

echo
echo "Done."
