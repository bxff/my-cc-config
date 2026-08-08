# my-cc-config

Personal Claude Code build. Routing comes from [claude-code-subagent-models](https://github.com/bxff/claude-code-subagent-models); this adds the subagent task-lifecycle QoL splices and the config.

## Install

```bash
npm install
./install.sh
ccd
```

`install.sh` patches the current `claude` binary into `~/.claude-ds/claude.js`, extracts the embedded native addons into `~/.claude-ds/natives/`, and installs the launchers. Revert: delete `~/.claude-ds`; the stock `claude` is never touched.

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
        { "name": "deepseek-v4-flash", "label": "DeepSeek V4 Flash", "description": "Cheap and fast, routed to DeepSeek" }
      ]
    }
  ]
}
```

Put your API key in `~/.claude-ds/env.sh` (gitignored). The launcher derives the routing payload, the Agent-tool model list, and the official `/model` picker entry from `config.json`, so config changes need no re-patch.

General Claude Code config lives in `claude/`:

```
claude/
├── settings.json   # hooks, theme, effort, plugins, model default
└── agents/
    └── deepseek-worker.md
```

`claude/settings.json`:

```json
{
  "cleanupPeriodDays": 36500,
  "env": {
    "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC": "1"
  },
  "model": "deepseek-v4-flash",
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

Sync `claude/` into `~/.claude` with:

```bash
./bin/sync-config.sh
```

Credentials and anything private are never part of the repo; `sync-config.sh` does not touch `~/.claude/.credentials.json`.

## The QoL patch

`patch-qol.mjs` splices the task list: 60-minute retention for completed subagents, `p`/`k` pinning, `x` dismiss, `d` detach (converts a subagent transcript into a resumable session and drops `claude --resume <uuid>` into the input), the `[p]` row markers, and the agents-view pin alias.

## Scripts

- `scripts/promote-all.sh`, `scripts/promote-agent.sh` — recover subagent transcripts as resumable sessions
- `scripts/subagent-keep.sh` — keep-alive for subagent sessions
- `scripts/test-hybrid.sh` — end-to-end test (makes real API calls)
