#!/usr/bin/env bash
# Copy markdown docs from the nyx source repo into docs-src/.
# Source is treated as canonical; this directory is a build input only.

set -euo pipefail

NYX_REPO="${NYX_REPO:-/Users/elipeter/nyx}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HERE/docs-src"

if [ ! -d "$NYX_REPO/docs" ]; then
  echo "error: $NYX_REPO/docs not found. Set NYX_REPO=/path/to/nyx" >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$DEST/detectors"

cp "$NYX_REPO/docs/"*.md "$DEST/"
cp "$NYX_REPO/docs/detectors/"*.md "$DEST/detectors/"

# Stub files use mdbook {{#include ../CHANGELOG.md}}; copy targets too.
[ -f "$NYX_REPO/CHANGELOG.md" ] && cp "$NYX_REPO/CHANGELOG.md" "$DEST/CHANGELOG.md"
[ -f "$NYX_REPO/ROADMAP.md" ] && cp "$NYX_REPO/ROADMAP.md" "$DEST/ROADMAP.md"

# Asset directory (images referenced from markdown).
if [ -d "$NYX_REPO/docs/assets" ]; then
  mkdir -p "$DEST/assets"
  cp -R "$NYX_REPO/docs/assets/." "$DEST/assets/"
fi

echo "Synced markdown to $DEST"
