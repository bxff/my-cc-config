#!/bin/bash
# install.sh — build the patched bundle from the current claude install.
# Writes ~/.claude-ds/claude.js and installs the launchers. Revert: delete
# ~/.claude-ds (the stock `claude` is never touched).
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN="${CC_RUN_DIR:-$HOME/.claude-ds}"
mkdir -p "$RUN"

BIN="$(command -v claude || true)"
[ -n "$BIN" ] || { echo "claude not found on PATH"; exit 1; }

node "$DIR/patch-claude.mjs" "$BIN" "$RUN/claude.js" --providers "$DIR/config.json"
cp "$DIR/bin/claude-ds" "$DIR/bin/ccd" "$DIR/bin/cc-env" "$DIR/config.json" "$RUN/"
cp "$DIR/scripts/subagent-keep.sh" "$RUN/"
ln -sf "$RUN/ccd" "$HOME/.local/bin/ccd"
echo "installed: $RUN/claude.js + launchers ($HOME/.local/bin/ccd)"
