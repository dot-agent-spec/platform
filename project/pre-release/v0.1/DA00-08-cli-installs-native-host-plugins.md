<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# LOG-DA00-08: How `configure --claude` writing MCP entries turned out not to be a harmless fallback

| Field | Value |
|---|---|
| Status | Investigation and decision complete; implementation not yet started (tracked in [Plan-002](../../plans/002-dot-agent-as-claude-plugin.md)) |
| Date | 2026-07-30 |
| Deciders | Danilo Borges |
| Related | [platform#27](https://github.com/dot-agent-spec/platform/issues/27) |

This is the long-form appendix to [DA00-08](../../adr/DA00-08-cli-installs-native-host-plugins.md). The
ADR records the settled decision and its consequences; this log carries the investigation that produced
it — the live evidence, what got ruled out first and why, and the questions deliberately left open —
none of which fit the ADR's Context/Consequences sections.

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) | cli (L4) |
|---|---|---|---|---|---|
| — | — | — | — | — | ✏️ |

(This decision touches only `apps/dot-agent-cli`'s `configure` command — no DSL layer changes. `cli`
above covers `apps/dot-agent-cli`, same scheme as the [DA00-07 log](DA00-07-plugin-packaging-across-llm-cli-hosts.md).)

## How this started

A code-review comment on `apps/dot-agent-cli/src/commands/configure.ts` noticed that the `claude` target
skips installing a skill file (`skillSupersededBy`, pointing the user at the plugin instead) but still
writes the `dot-agent` and `dot-agent-helper` MCP server entries into `~/.claude.json` — even though
`plugins/claude/.claude-plugin/plugin.json` already declares both. First read: intentional and settled.
Commit `ae5d8a6` (`feat(cli)!: stop installing a Claude skill file; the plugin delivers it`) scoped its
fix to skills only, and `tests/configure.test.ts:49-67` asserts the MCP write as expected behavior. The
GitHub issue opened to track it, [platform#27](https://github.com/dot-agent-spec/platform/issues/27), was
first labeled `wontfix` on that reading.

## The evidence that overturned it

Inspecting the maintainer's own `~/.claude.json` (a live install, both the `dot-agent` plugin and past
`dot-agent configure --claude` runs having touched it over time) found:

```
mcpServers:
  dot-agent         -> command: dot-agent, args: [run, --helper]              (WRONG — helper's args under the dev server's name)
  dot-agent-helper  -> command: dot-agent, args: [run, --helper]              (correct, but now duplicated)
  dot-agent-dev     -> command: dot-agent, args: [server-mcp, --mcp-transport, stdio]   (the name STALE_SERVER_NAMES exists to delete)
```

Three server names for two servers, and the `dot-agent` name — the one both the plugin manifest and a
correct CLI write would use for the dev/runtime server — bound to the helper's arguments instead. Inside
this very session, `mcp__dot-agent__*` exposed the helper's 6 tools, not the 10 the dev server (with
authoring tools folded in, per the [DA00-07 log](DA00-07-plugin-packaging-across-llm-cli-hosts.md)'s P2)
actually has; the authoring tools were reachable only under the stale `dot-agent-dev` name. The machine
was two CLI-layout renames behind, and nothing had prompted a re-run of `configure` to catch up.

That reframed the write itself: `STALE_SERVER_NAMES` (`configure.ts:59`) exists *only* to clean up a name
an earlier `configure --claude` itself introduced. The command was not a fallback filling a gap the
plugin left — it was the sole author of the gap, and the "fallback" framing had been circular the whole
time: CLI writes a server name → a later rename makes that name stale → `configure` grows a migration
step to delete it → the migration step is only reachable by writing again. Nothing outside the CLI's own
past runs was cleaning anything up.

## What Claude Code's own docs say

Fetched and read `docs.claude.com/en/docs/claude-code/{mcp,plugins,plugins-reference}` directly rather
than reasoning from the plugin's behavior alone:

- **No de-duplication.** *"Claude Code offers plugin MCP tools alongside manually configured MCP tools."*
  Confirmed live and unrelated to dot-agent: `chrome-devtools` is registered both via plugin and via user
  config on this machine, and both `mcp__chrome-devtools__*` and
  `mcp__plugin_chrome-devtools-mcp_chrome-devtools__*` tool families are present in the same session.
- **The plugin owns its own server lifecycle.** *"You add and remove plugin servers by installing or
  uninstalling the plugin."* A plugin manifest is declarative and strictly additive — nothing in that
  mechanism can reach into `~/.claude.json` and remove an entry a different tool wrote there.
- **The update guarantee has a precondition.** Claude Code resolves a plugin's version, for update
  purposes, from `plugin.json`'s `version` field first. *"Pushing new commits without bumping it has no
  effect."* Both `plugins/claude/.claude-plugin/plugin.json` and the root `.claude-plugin/marketplace.json`
  pin `"version": "0.1.0"` today — a manifest change that ships without a version bump reaches nobody
  already running the plugin. This is now load-bearing for ADR-DA00-08 in a way it was not when the CLI
  also wrote the config as a backup path, and is called out in the ADR's Consequences.
- **Same-name collision between a plugin server and a user-config server of the same name is
  undocumented.** Searched specifically; found no coverage either way. Deliberately left open — see below.

Also verified directly, by running `--help` against the installed `claude` binary (2026-07-30): `claude
plugin install <plugin>` (idempotent — re-running against an already-installed plugin exits 0 with *"is
already installed"*), `claude plugin marketplace add <source>` (supports `--sparse <paths...>` for
monorepo checkouts), `claude plugin list --json` / `claude plugin marketplace list --json` (structured
output for reporting, not required for idempotency). These are the primitives ADR-DA00-08's "invokes the
host's own plugin commands" cashes out to.

## Framings considered and rejected before the ADR

1. **"Intentional, harmless fallback for users without the plugin."** The framing that produced the
   original `wontfix`. Falls apart on the evidence above: it is not harmless (duplicate or shadowed
   servers, depending on which side wins an undocumented collision) and it is not a fallback for an
   *external* gap — it is cleanup for a gap the same command created.
2. **"The CLI is the necessary migration mechanism, since a manifest can't delete."** True that a manifest
   can't delete — that half of the reasoning survives into the ADR. False that this justifies the *write*
   half: the CLI only ever needs to migrate its own past output. Once it stops writing, there is nothing
   left to migrate after the current install base ages out.
3. **"Detect whether the plugin is installed, write only as a fallback."** Considered and rejected in the
   ADR itself (Option C) for a reason worth restating here: the only signal available is
   `~/.claude/plugins/installed_plugins.json`, an internal file with no documented schema or stability
   guarantee. Building a load-bearing check on it would be trading one undocumented assumption (today's
   silent duplication) for another (tomorrow's silent breakage on a Claude Code internal-layout change).
4. **"Print install instructions, write nothing"** — the shape `skillSupersededBy` already used for
   skills. Doesn't touch the actual defect: whatever a previous CLI run already wrote stays in
   `~/.claude.json` forever, since nothing else can remove it.

## The gap left deliberately open

Claude Code's behavior when a plugin and a user config declare an MCP server under the *same* name is
unverified and undocumented. ADR-DA00-08 does not resolve this — it routes around it. Whichever way the
host resolves that collision (duplicate registration, plugin wins, user config wins), having exactly one
registration path per host — the plugin, with the CLI's role reduced to installing it and deleting its own
past leftovers — is the correct shape. The live end-to-end test (install via `dot-agent configure
--claude`, confirm the three legacy entries are gone from `~/.claude.json`, restart, confirm the plugin's
servers work) is deferred to actual implementation and will settle the collision question as a side
effect, not as a precondition for the decision.

## Outcome

[ADR-DA00-08](../../adr/DA00-08-cli-installs-native-host-plugins.md) accepted 2026-07-30, complementing
[DA00-07](../../adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md) rather than superseding it — DA00-07
settled the per-host plugin *shape*; DA00-08 settles the relationship between that shape and the CLI
command that used to duplicate it. [platform#27](https://github.com/dot-agent-spec/platform/issues/27)
relabeled `wontfix` → `enhancement`. Implementation is a new track on
[Plan-002](../../plans/002-dot-agent-as-claude-plugin.md), not yet started as of this log.
