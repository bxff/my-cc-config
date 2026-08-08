#!/bin/bash
# promote-agent.sh — detach a completed subagent into a standalone, resumable session.
#
# Usage:
#   ~/.claude-ds/promote-agent.sh <agentId>
#   ~/.claude-ds/promote-agent.sh            # use the most recent id from subagents.log
#
# What it does:
#   1. Locates the subagent transcript: ~/.claude/projects/<proj>/<parent>/subagents/agent-<id>.jsonl
#   2. Converts it into a normal session file at the PROJECT ROOT:
#        ~/.claude/projects/<proj>/<new-uuid>.jsonl
#      - mints a fresh session UUID
#      - stamps uuid/timestamp/sessionId on every message (the loader requires them)
#      - re-linearizes the parentUuid chain so the conversation chain is valid
#      - clears isSidechain (the --resume list filters sidechain sessions out)
#   3. Prints:  claude --resume <new-uuid>
#
# Why this works (verified in source): `claude --resume` scans root-level
# <uuid>.jsonl files; subagent transcripts are nested under the parent session
# dir and are filtered as sidechain — hence the conversion.
set -u
ID="${1:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$HOME/.claude-ds/subagents.log"

if [ -z "$ID" ]; then
  ID=$(tail -1 "$LOG" 2>/dev/null | grep -oE 'agent=[a-zA-Z0-9_-]+' | cut -d= -f2)
  if [ -z "$ID" ]; then
    echo "usage: promote-agent.sh <agentId>" >&2
    exit 1
  fi
  echo "using most recent agent: $ID" >&2
fi

TRANSCRIPT=$(find "$HOME/.claude/projects" -path "*/subagents/agent-${ID}.jsonl" 2>/dev/null | head -1)
if [ -z "$TRANSCRIPT" ]; then
  echo "ERROR: no transcript found for agent '$ID'" >&2
  exit 1
fi

python3 - "$TRANSCRIPT" <<'PYEOF'
import json, sys, uuid, datetime, os

src = sys.argv[1]
lines = open(src).read().splitlines()
if not lines:
    print("ERROR: empty transcript", file=sys.stderr); sys.exit(1)

# project root = two levels up from subagents/agent-<id>.jsonl
project_dir = os.path.dirname(os.path.dirname(os.path.dirname(src)))
new_id = str(uuid.uuid4())

msgs = []
for raw in lines:
    try:
        d = json.loads(raw)
    except Exception:
        continue
    t = d.get("type")
    if t not in ("user", "assistant", "attachment", "direct", "text", "thinking"):
        continue  # keep only conversation-bearing entries
    # normalize: stamp identity fields the loader requires
    d["uuid"] = d.get("uuid") or str(uuid.uuid4())
    d["timestamp"] = d.get("timestamp") or datetime.datetime.now(datetime.timezone.utc).isoformat()
    d["sessionId"] = new_id
    d["isSidechain"] = False
    msgs.append(d)

if not msgs:
    print("ERROR: no messages to promote", file=sys.stderr); sys.exit(1)

# re-linearize the parentUuid chain (leaf = last message; loader computes leaves)
prev = None
for m in msgs:
    m["parentUuid"] = prev
    prev = m["uuid"]

out_path = os.path.join(project_dir, new_id + ".jsonl")
with open(out_path, "w") as f:
    f.write(json.dumps({"type": "mode", "mode": "normal", "sessionId": new_id}) + "\n")
    f.write(json.dumps({"type": "permission-mode", "permissionMode": "default", "sessionId": new_id}) + "\n")
    for m in msgs:
        f.write(json.dumps(m) + "\n")
    f.write(json.dumps({
        "type": "last-prompt",
        "prompt": msgs[0].get("message", {}).get("content", "") if isinstance(msgs[0].get("message", {}).get("content"), str) else "",
        "sessionId": new_id,
        "timestamp": msgs[-1].get("timestamp"),
        "uuid": str(uuid.uuid4()),
    }) + "\n")
os.chmod(out_path, 0o600)

print(f"promoted agent {msgs[0].get('agentId', '?')} -> {out_path}")
print(f"resume with:  claude --resume {new_id}")
print(f"({len(msgs)} messages, {msgs[0].get('agentId','?')})")
PYEOF
