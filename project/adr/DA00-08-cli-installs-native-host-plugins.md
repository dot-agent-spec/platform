<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-DA00-08: CLI Installs Native Host Plugins Instead of Writing Host Config

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-30 |
| Deciders | Danilo Borges |

---

## Context

[DA00-07](DA00-07-plugin-packaging-across-llm-cli-hosts.md) established one thin plugin per host under
`plugins/<host>/`. It did not settle what `dot-agent configure` should do once such a plugin exists, and
the two grew into independent registration paths for the same thing: `plugins/claude/.claude-plugin/plugin.json`
declares the `dot-agent` and `dot-agent-helper` MCP servers, and `apps/dot-agent-cli/src/commands/configure.ts`
writes those same two servers into `~/.claude.json`.

Claude Code's documentation is explicit that these do not merge: plugin MCP tools are offered *alongside*
manually configured ones, and plugin servers are added and removed **by installing or uninstalling the
plugin**. A plugin manifest is therefore declarative and additive — it can never remove an entry a previous
CLI run wrote. The consequence is already observable in the field: `STALE_SERVER_NAMES` in `configure.ts`
exists solely to clean up a server name the CLI itself introduced under an earlier layout, and a machine
was found carrying config two renames behind, with the `dot-agent` name bound to the helper's arguments
instead of the dev server's. Config the CLI writes only ages, because re-running `configure` is a manual
step nobody repeats.

Half of this was already conceded: the `claude` target stopped copying a skill file and instead printed
instructions telling the user to install the plugin themselves. The MCP half kept writing. The project has
no released users yet, so the behaviour can change without a migration burden.

## Decision

We will make `dot-agent configure` **prefer the host's native plugin mechanism and perform the
installation itself**. For a host that has a dot-agent plugin — Claude Code today — `configure` invokes
that host's own plugin commands (registering the `dot-agent-spec` marketplace, then installing the
`dot-agent` plugin) and removes any dot-agent MCP entries a previous CLI run left in the host's config
file. It neither writes those entries nor merely prints guidance. Writing skill files and MCP entries
directly remains the behaviour **only for hosts where dot-agent has no plugin format yet** — currently
`gemini` and `murici`.

## Options considered

- **Option A — Keep writing host config everywhere (status quo).** Pro: one uniform code path, and it
  works with no host CLI present. Con: creates entries only a later `configure` run can remove, so every
  rename strands users on stale names; and with no de-duplication in the host, the written entries either
  duplicate the plugin's tools in every session or shadow them with older arguments. (rejected)
- **Option B — Print install instructions, write nothing.** Pro: minimal change; extends the existing
  skill behaviour to MCP for free. Con: leaves whatever a previous CLI run wrote in place, which is the
  actual defect; and it hands the user manual work that the command exists to do. (rejected)
- **Option C — Detect whether the plugin is installed, write only as a fallback.** Pro: keeps a working
  path for both populations without duplication. Con: detection means reading
  `~/.claude/plugins/installed_plugins.json`, an internal file with no documented contract — a layout
  change would silently reintroduce double registration. (rejected)
- **Option D (chosen) — Install the native plugin, and clean up what the CLI wrote before.** Pro: one
  registration path per host, so updates arrive through the plugin's own update mechanism rather than
  depending on the user re-running a command; the skill/MCP asymmetry in the `claude` target disappears;
  and the CLI keeps the one capability a manifest structurally cannot have, which is deletion. Con: the
  CLI now shells out to each host's CLI and must handle that binary being absent, and the guarantee that
  updates propagate is only as good as the plugin's release discipline (see Consequences).

## Consequences

`configure` gains a single, honest meaning — "make this host ready to drive `.agent` projects" — while
the mechanism varies per host. The `skillSupersededBy` field and the asymmetry it created in the `claude`
target both become unnecessary and should be removed: with the plugin installed by the command itself,
skills and MCP servers are delivered the same way, by the same authority.

The costs accepted are real. The CLI acquires a dependency on each host's own CLI being installed and on
its plugin subcommands staying stable, and must fail clearly when that binary is missing rather than
silently falling back to writing config. Cleanup touches a user's existing configuration, so it must be
conservative — removing only the server names dot-agent itself writes or has written, never a neighbouring
entry. Adding a future host now requires an explicit choice between the two shapes, plugin-install or
file-write, and that choice belongs in the host's own `plugins/<host>/` documentation.

The update guarantee this decision leans on has a precondition worth stating: both
`plugins/claude/.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` pin an explicit
`version`, and Claude Code uses that field as the update cache key — a manifest change shipped without
bumping it reaches nobody. Release discipline is therefore load-bearing here in a way it was not when the
CLI also wrote the config.

One question remains deliberately unanswered: the host's behaviour when a plugin and a user config declare
the same server name is undocumented. This decision is robust to every outcome — duplication, shadowing in
either direction — because all of them are resolved by having a single registration path. While both paths
still exist in code, a mechanical guard asserting that `SERVERS` in `configure.ts` matches the manifest
would catch drift that is currently held only by convention.

## Related

- [DA00-07](DA00-07-plugin-packaging-across-llm-cli-hosts.md) — established the per-host plugin shape this
  decision defers to; complements it, does not supersede it.
- [`apps/dot-agent-cli/src/commands/configure.ts`](../../apps/dot-agent-cli/src/commands/configure.ts) —
  the command this decision changes.
- [`plugins/claude/.claude-plugin/plugin.json`](../../plugins/claude/.claude-plugin/plugin.json) and
  [`.claude-plugin/marketplace.json`](../../.claude-plugin/marketplace.json) — the manifests that become
  the single source of registration for Claude Code.
- [platform#27](https://github.com/dot-agent-spec/platform/issues/27) — the report that surfaced the
  double-registration behaviour.
- Paired long-form log: [`project/pre-release/v0.1/DA00-08-cli-installs-native-host-plugins.md`](../pre-release/v0.1/DA00-08-cli-installs-native-host-plugins.md).
