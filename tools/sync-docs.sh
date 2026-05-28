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

# Nyx docs reference screenshots from the scanner repo's top-level assets
# directory. Mirror those into docs-src so the docs build can publish them.
if [ -d "$NYX_REPO/assets/screenshots" ]; then
  [ -L "$NYX_DEST/assets" ] && rm "$NYX_DEST/assets"
  mkdir -p "$NYX_DEST/assets/screenshots/docs"
  [ -f "$NYX_REPO/assets/screenshots/cli-scan.png" ] &&
    cp "$NYX_REPO/assets/screenshots/cli-scan.png" "$NYX_DEST/assets/screenshots/cli-scan.png"
  if [ -d "$NYX_REPO/assets/screenshots/docs" ]; then
    for screenshot in "$NYX_REPO/assets/screenshots/docs/"*.png; do
      case "$screenshot" in
        *_raw.png) continue ;;
      esac
      cp "$screenshot" "$NYX_DEST/assets/screenshots/docs/"
    done
  fi
fi

# Stub files use mdbook {{#include ../CHANGELOG.md}}; copy targets too.
[ -f "$NYX_REPO/CHANGELOG.md" ] && cp "$NYX_REPO/CHANGELOG.md" "$NYX_DEST/CHANGELOG.md"
[ -f "$NYX_REPO/ROADMAP.md" ] && cp "$NYX_REPO/ROADMAP.md" "$NYX_DEST/ROADMAP.md"

echo "Synced markdown to $DEST"
