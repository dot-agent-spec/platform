---
"@dot-agent/cli": minor
---

**Breaking: `dot-agent configure --claude` now installs the native Claude Code plugin instead of writing MCP entries into `~/.claude.json`.** It shells out to `claude plugin marketplace add dot-agent-spec/platform` and `claude plugin install dot-agent@dot-agent-spec` (idempotent — safe to re-run), then removes any `dot-agent`/`dot-agent-helper`/`dot-agent-dev` entries an older version of this command left behind. `--skill`/`--mcp` no longer apply to `--claude` — a plugin install always delivers both; they still narrow `--gemini`/`--murici`, which have no plugin format yet and are unaffected otherwise. See [ADR-DA00-08](../../project/adr/DA00-08-cli-installs-native-host-plugins.md) for why: the plugin manifest already declared the same two servers, config this CLI wrote only grew stale as the server names changed, and nothing but the CLI itself could ever remove what it had written.
