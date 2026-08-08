#!/bin/bash
# promote-all.sh — recover every subagent transcript of a session as a resumable
# session. This is the answer to "I closed ccd and my subagents are gone":
# the task tree is runtime state (not rehydrated on resume), but every
# subagent transcript persists on disk — this turns them back into sessions.
#
# Usage:
#   ~/.claude-ds/promote-all.sh                 # latest session of the current project
#   ~/.claude-ds/promote-all.sh <sessionId>     # a specific session
#   ~/.claude-ds/promote-all.sh all             # every session of the current project
#
# Prints one `claude --resume <uuid>` line per promoted subagent.
set -u
SESSION="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMOTE="$SCRIPT_DIR/promote-agent.sh"
PROJ_KEY=$(echo "$PWD" | tr '/' '-')
PROJ_DIR="$HOME/.claude/projects/$PROJ_KEY"

[ -d "$PROJ_DIR" ] || { echo "no project dir: $PROJ_DIR" >&2; exit 1; }

pick_sessions() {
  if [ "$SESSION" = "all" ]; then
    ls -dt "$PROJ_DIR"/*/ 2>/dev/null | xargs -n1 basename
  elif [ -n "$SESSION" ]; then
    echo "$SESSION"
  else
    # latest session dir that still has subagent transcripts
    for d in $(ls -dt "$PROJ_DIR"/*/ 2>/dev/null); do
      s=$(basename "$d")
      [ -d "$PROJ_DIR/$s/subagents" ] && [ "$(ls "$PROJ_DIR/$s/subagents"/agent-*.jsonl 2>/dev/null | wc -l | tr -d ' ')" -gt 0 ] && { echo "$s"; break; }
    done
  fi
}

total=0
for s in $(pick_sessions); do
  SUB_DIR="$PROJ_DIR/$s/subagents"
  for f in "$SUB_DIR"/agent-*.jsonl; do
    [ -f "$f" ] || continue
    id=$(basename "$f" .jsonl | cut -c7-)   # strip "agent-"
    cmd=$("$PROMOTE" "$id" 2>/dev/null | grep -oE 'claude --resume [a-f0-9-]+' | tail -1)
    if [ -n "$cmd" ]; then
      echo "  [$id]  $cmd"
      total=$((total+1))
    else
      echo "  [$id]  (failed — see promote-agent.sh)" >&2
    fi
  done
done
echo
echo "$total subagent(s) recovered. Resume any of them with the printed command;"
echo "or with the original: claude --resume <uuid>"
