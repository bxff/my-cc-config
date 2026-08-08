#!/bin/bash
# sync-config.sh — copy the repo's claude/ config into ~/.claude.
# The repo is the source of truth for settings.json. Credentials are never
# touched (~/.claude/.credentials.json stays).
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

cp "$DIR/claude/settings.json" "$DEST/settings.json"

echo "synced claude/ -> $DEST"
