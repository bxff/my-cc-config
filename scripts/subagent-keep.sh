#!/bin/bash
# subagent-log.sh — SubagentStop hook, SILENT by default.
#
# Why: prompting on every subagent stop is noise. Subagents don't need to be
# kept "open" — their transcripts persist on disk, and you continue them with
# SendMessage({to: "<agent_id>"}) whenever you want. All we need is the handle.
#
# Behavior:
#   default          -> logs the agent_id + transcript path to
#                       ~/.claude-ds/subagents.log and ALLOWS the stop.
#                       Zero prompts, zero interference.
#   interactive mode -> (opt-in: CLAUDE_CODE_SUBAGENT_KEEP=interactive)
#                       prompts [k]eep / [e]nd / [d]etach like before.
set -u
INPUT=$(cat)
PY='import sys,json
try: d=json.load(sys.stdin)
except Exception: d={}
print(d.get("agent_id","") or "")
'
AGENT_ID=$(echo "$INPUT" | python3 -c "$PY" 2>/dev/null)
AGENT_TYPE=$(echo "$INPUT" | python3 -c "import sys,json;print(json.load(sys.stdin).get('agent_type',''))" 2>/dev/null)
STOP_ACTIVE=$(echo "$INPUT" | python3 -c "import sys,json;print(str(json.load(sys.stdin).get('stop_hook_active',False)).lower())" 2>/dev/null)
TRANSCRIPT=$(echo "$INPUT" | python3 -c "import sys,json;print(json.load(sys.stdin).get('agent_transcript_path',''))" 2>/dev/null)

# always record the handle — this is the "survives" part
if [ -n "$AGENT_ID" ]; then
  echo "$(date +%FT%T) agent=$AGENT_ID type=${AGENT_TYPE:-?} transcript=${TRANSCRIPT:-?}" >> "$HOME/.claude-ds/subagents.log" 2>/dev/null || true
fi

# loop guard
if [ "$STOP_ACTIVE" = "true" ]; then
  echo '{"decision":"allow"}'; exit 0
fi

# silent by default
if [ "${CLAUDE_CODE_SUBAGENT_KEEP:-0}" != "interactive" ]; then
  echo '{"decision":"allow"}'; exit 0
fi

# opt-in interactive mode (non-TTY auto-allows)
if [ ! -t 1 ]; then
  echo '{"decision":"allow"}'; exit 0
fi
echo "" >&2
echo "── Subagent finished: ${AGENT_TYPE:-?} (${AGENT_ID:-?}) ──" >&2
echo "  [k] keep alive   [e] end   [d] detach (resume later via SendMessage)" >&2
read -r -p "  choice [e]: " CHOICE < /dev/tty 2>/dev/null || CHOICE="e"
case "$CHOICE" in
  k|K) echo '{"decision":"block","reason":"Continue working on your task without summarizing or stopping. The user wants to keep you alive — keep making progress, or state what you need to continue."}' ;;
  d|D) echo '{"decision":"allow"}'; echo "  detached: ${AGENT_ID} — resume with SendMessage({to: \"${AGENT_ID}\"})" >&2 ;;
  *)   echo '{"decision":"allow"}' ;;
esac
exit 0
