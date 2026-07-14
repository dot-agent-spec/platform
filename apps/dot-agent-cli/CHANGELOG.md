# Changelog

All notable changes to `@dot-agent/cli` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Fixed
- `dot-agent pack` and `dot-agent run <dir>` failed with a false-positive `E018` for any agent whose `teach`/`guide` targets lived under `knowledge/` or `guides/` — including this package's own `helper-src/`. Fixed in `@dot-agent/compiler`; see its changelog for the root cause. Until now, `npm run repack-helper` (and therefore `prepublishOnly`) could not succeed.
- The helper agent's navigable topics documented in `skills/dot-agent/SKILL.md` (`about`, `dsl`, `mcp`, `generate`, `example`) were stale relative to the live FSM since the `bb1c808` navigation flattening — the real topics from `init` are `dsl`, `gen`, `cli`, `pack`. Sending a stale-but-documented intent silently no-opped (`{"ok":true,"effects":[]}`, no error, no state change), so a client following the skill literally could get stuck with no signal anything was wrong. Corrected to match the live topics and reframed as illustrative, always deferring to a live `dot-agent://intents` read.
- The generic `dot-agent://howto` MCP resource (served by every `.agent`-powered MCP server, not just the helper — also passed as the server's `instructions` field) told an already-connected client to "run dot-agent with --helper and connect", which is circular when that client *is* already connected to the helper. It also never explained how to resolve a `teach` effect's filename into actual content. Rewritten to document `dot-agent://knowledge/{name}` resolution and to warn that valid intents are state-dependent and must be re-read after every transition, matching the intent-matching convention already described in `SKILL.md`'s Emulation Mode section (never forward a user's raw reply as the intent — match it against the current `dot-agent://intents` first).

### Added
- `repack-helper` script, wired into `prepublishOnly`, so a stale or out-of-sync `assets/helper.agent` can never ship silently again.
- `pack` and `run` now surface `W015` for files left in `guides/`/`knowledge/` that no `guide`/`teach` statement references. Such files are **not** bundled — only linked content is packed.
- `dot-agent --help` (and the bare `dot-agent` invocation) now leads with a "Getting started" block aimed at an AI assistant doing first-time setup: the Node >=24 requirement, `dot-agent configure --claude`/`--gemini` as the recommended first command, and a reminder to reconnect the MCP session afterward — without hardcoding any topic/intent name, since those only live in the FSM and would drift again.
- `dot-agent configure` now prints an explicit reminder to restart/reconnect the MCP client after registering the new servers, since they aren't visible until the client reconnects.

### Changed
- `assets/helper.agent` regenerated from `helper-src/`.

### Documentation
- `README.md` and the helper's own knowledge (`helper-src/knowledge/pack.md`, `dsl-overview.md`) now state the linked-only rule: a file in `guides/`/`knowledge/` is packed only when the behavior names it, and an unreferenced one is reported (`W015`) and left out. An unreferenced file would be unreachable at runtime anyway — the host only ever learns a filename from a `teach` effect, and there is no way to list the knowledge directory.

---

## [0.10.0] - 2026-07-10

- First public release on npm. See repository history for prior development.
