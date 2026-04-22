#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 <version>"
  echo "  version  Semver string, e.g. 2.1.3 or v2.1.3"
  exit 1
}

[[ $# -lt 1 ]] && usage

VERSION="${1#v}" # strip leading 'v' if present

if ! echo "$VERSION" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  echo "Error: version must follow semver format (e.g. 2.1.3)"
  exit 1
fi

TAG="v${VERSION}"

if git rev-parse "$TAG" > /dev/null 2>&1; then
  echo "Error: tag $TAG already exists"
  exit 1
fi

# Ensure working tree is clean
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: working tree has uncommitted changes — commit or stash them first"
  exit 1
fi

echo "Creating tag $TAG on $(git rev-parse --abbrev-ref HEAD) ($(git rev-parse --short HEAD))..."
git tag -a "$TAG" -m "Release $TAG"

echo "Pushing tag $TAG to origin..."
git push origin "$TAG"

echo "Done — $TAG published."
