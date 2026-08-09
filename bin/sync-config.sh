#!/bin/bash
# sync-config.sh — copy the repo's claude/ config into ~/.claude.
# The repo is the source of truth for settings.json. Credentials are never
# touched (~/.claude/.credentials.json stays). The current
# ~/.claude/settings.json is backed up before it is overwritten: backups are
# timestamped, never overwritten, and the newest 10 are kept.
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"

if [ -f "$DEST/settings.json" ]; then
  BAK="$DEST/settings.json.bak-$(date +%Y%m%d-%H%M%S)"
  cp "$DEST/settings.json" "$BAK"
  echo "backed up: $BAK"
  # rotate: keep the newest 10 backups
  ls -1t "$DEST"/settings.json.bak-* 2>/dev/null | tail -n +11 | xargs -r rm --
fi

cp "$DIR/claude/settings.json" "$DEST/settings.json"
echo "synced claude/ -> $DEST/settings.json"
