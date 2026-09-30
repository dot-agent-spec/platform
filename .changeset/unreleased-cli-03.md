---
"@dot-agent/cli": minor
---

`ConfigureResult` gained `target`, `pluginId`, `pluginVersion`, `pluginEnabled`, `marketplaceName`, `marketplaceSource`, `marketplaceAdded`, `legacyConfigPath`, and `legacyEntriesRemoved`; `dest`/`mcpConfigPath`/`mcpConfigured`/`skillInstalled`/`registeredServers`/`skillSkippedReason` are now only populated for `gemini`/`murici`. The MCP tool `dot_agent_configure` gained a `murici` parameter (previously only in the CLI) and refuses the `claude` target when called from inside a live Claude Code session (`CLAUDECODE` env var set), to avoid a child process racing the parent session over the plugin registry and `~/.claude.json`.
