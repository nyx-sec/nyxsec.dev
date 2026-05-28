#!/usr/bin/env bash
# Copy markdown docs from the source repos into docs-src/.
# Sources are treated as canonical; this directory is a build input only.

set -euo pipefail

NYX_REPO="${NYX_REPO:-/Users/elipeter/nyx}"
NYX_AGENT_REPO="${NYX_AGENT_REPO:-/Users/elipeter/nyctos}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HERE/docs-src"
NYX_DEST="$DEST/nyx"
AGENT_DEST="$DEST/agent"

if [ ! -d "$NYX_REPO/docs" ]; then
  echo "error: $NYX_REPO/docs not found. Set NYX_REPO=/path/to/nyx" >&2
  exit 1
fi

if [ ! -d "$NYX_AGENT_REPO/docs" ]; then
  echo "error: $NYX_AGENT_REPO/docs not found. Set NYX_AGENT_REPO=/path/to/nyx-agent" >&2
  exit 1
fi

rm -rf "$DEST"
mkdir -p "$NYX_DEST" "$AGENT_DEST"

cp -R "$NYX_REPO/docs/." "$NYX_DEST/"
cp -R "$NYX_AGENT_REPO/docs/." "$AGENT_DEST/"

# Stub files use mdbook {{#include ../CHANGELOG.md}}; copy targets too.
[ -f "$NYX_REPO/CHANGELOG.md" ] && cp "$NYX_REPO/CHANGELOG.md" "$NYX_DEST/CHANGELOG.md"
[ -f "$NYX_REPO/ROADMAP.md" ] && cp "$NYX_REPO/ROADMAP.md" "$NYX_DEST/ROADMAP.md"

echo "Synced markdown to $DEST"
