#!/bin/bash
# Hybrid test suite — run this YOURSELF. It makes real API calls
# (tiny amounts of subscription quota + DeepSeek credits).
set -e
D=~/.claude-ds

echo "== 1) Subscription path (opus, via your existing login) =="
"$D/claude-ds" -p "Reply with exactly: hi" --model opus
echo
echo "== 2) DeepSeek path (real endpoint, real key from env.sh) =="
"$D/claude-ds" -p "Reply with exactly: hi" --model deepseek-v4-flash
echo
echo "== 3) Hybrid: main=opus on subscription, subagent=DeepSeek =="
"$D/claude-ds" -p "Spawn an Agent subagent and report what it says" \
  --model opus --allowedTools "Agent" --agents "general-purpose"
echo
echo "== 4) Control: default claude unchanged (subagent stays on Anthropic) =="
claude -p "Spawn an Agent subagent and report what it says" \
  --model opus --allowedTools "Agent" --agents "general-purpose"
echo
echo "DONE. Verify billing split:"
echo "  - Anthropic console: opus turns only"
echo "  - DeepSeek console:  deepseek-v4-flash turns (the authoritative routing proof)"
echo "  - /cost inside a session: shows deepseek-v4-flash with unknown-cost note"
