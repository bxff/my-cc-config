# my-cc-config

Personal Claude Code build. Routing comes from [claude-code-subagent-models](https://github.com/bxff/claude-code-subagent-models); this adds the subagent task-lifecycle QoL splices and the config.

## Install

```bash
npm install
./install.sh
ccd
```

`install.sh` builds the patched bundle from the current `claude` binary into `~/.claude-ds/claude.js` (routing + QoL + native addons + the execpath override, in one pass), and installs the launchers. Revert: delete `~/.claude-ds`; the stock `claude` is never touched.

## Config

`config.json` lists providers and their models:

```json
{
  "providers": [
    {
      "id": "deepseek",
      "prefix": "deepseek",
      "baseUrl": "https://api.deepseek.com/anthropic",
      "apiKeyEnv": "CC_DEEPSEEK_API_KEY",
      "models": [
        { "name": "deepseek-v4-flash", "label": "DeepSeek V4 Flash", "description": "Cheap and fast, routed to DeepSeek" },
        { "name": "deepseek-v4-pro", "label": "DeepSeek V4 Pro", "description": "Strongest DeepSeek model, routed to DeepSeek" }
      ]
    }
  ]
}
```

The launchers (`ccd` / `claude-ds`) source `~/.claude-ds/env.sh` (gitignored, holds `CC_DEEPSEEK_API_KEY`) and derive the routing payload, the Agent-tool model list (`CC_EXTRA_MODELS`), the `/model` picker entry (`ANTHROPIC_CUSTOM_MODEL_OPTION`), and the full picker list (`CC_PICKER_MODELS`) from `config.json`, so config changes need no re-patch. Adding a model to `config.json` is enough — it appears in both the Agent tool dropdown and the `/model` picker.

To run the raw extension command (`ccr`) without the launchers, the same env must reach the bundle at startup. Claude Code loads `~/.claude/settings.json` `"env"` into the process, so put the provider key and routing vars there too:

`claude/settings.json`:

```json
{
  "cleanupPeriodDays": 36500,
  "env": {
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1",
    "CC_DEEPSEEK_API_KEY": "",
    "CC_PROVIDERS": "[{\"prefix\":\"deepseek\",\"baseUrl\":\"https://api.deepseek.com/anthropic\",\"apiKeyEnv\":\"CC_DEEPSEEK_API_KEY\"}]",
    "CC_EXTRA_MODELS": "deepseek-v4-flash,deepseek-v4-pro",
    "CLAUDE_CODE_MAX_CONTEXT_TOKENS": "500000",
    "ANTHROPIC_CUSTOM_MODEL_OPTION": "deepseek-v4-flash",
    "ANTHROPIC_CUSTOM_MODEL_OPTION_NAME": "DeepSeek V4 Flash",
    "ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION": "Cheap and fast, routed to DeepSeek"
  },
  "hooks": {
    "SubagentStop": [
      {
        "matcher": "*",
        "hooks": [
          { "type": "command", "command": "/Users/dexdevlon/.claude-ds/subagent-keep.sh", "timeout": 120000 }
        ]
      }
    ]
  },
  "viewMode": "verbose",
  "effortLevel": "high",
  "tui": "fullscreen",
  "showThinkingSummaries": true,
  "skipDangerousModePermissionPrompt": true,
  "theme": "dark",
  "verbose": true,
  "agentPushNotifEnabled": true
}
```

`CLAUDE_CODE_MAX_CONTEXT_TOKENS` sets the context window for non-`claude-*` models (Claude models are unaffected). Without it, DeepSeek defaults to 200K. At 500K, auto-compaction triggers at ~467K tokens — the same mechanism Claude uses for its own models (e.g. Opus 4.6 at 200K compacts around 160K).

Sync `claude/` into `~/.claude` with:

```bash
./bin/sync-config.sh
```

`sync-config.sh` backs up the current `~/.claude/settings.json` first (timestamped backups, newest 10 kept, never overwritten), so run it before filling in the key and you can always restore. Credentials and anything private are never part of the repo; `sync-config.sh` does not touch `~/.claude/.credentials.json`.

## The QoL patch

`patch-qol.mjs` splices the task list: 60-minute retention for completed subagents, teammates, and in-process tasks, `p`/`k` pinning, `x` dismiss, `d` detach (converts a subagent transcript into a resumable session and drops `claude --resume <uuid>` into the input), the `[p]` row markers, and the agents-view pin alias.

## Scripts

- `scripts/promote-all.sh`, `scripts/promote-agent.sh` — recover subagent transcripts as resumable sessions
- `scripts/subagent-keep.sh` — keep-alive for subagent sessions
- `scripts/test-hybrid.sh` — end-to-end test (makes real API calls)
