# Changelog

All notable changes to `@dot-agent/cli` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.11.1] - 2026-07-16

### Dependencies
- Re-pinned `@dot-agent/sdk` → `0.10.3` and `@dot-agent/compiler` → `0.10.2` to pick up the browser-bundle fix and packer changes from this release round.

### Fixed
- `dot-agent pack` produced `.agent` bundles with doubled content paths (`knowledge/knowledge/x.md`) and misfiled guides (a `teach "guides/x.md"` landed under `knowledge/guides/…`) whenever a `teach`/`guide` reference carried its namespace prefix — which every real agent does. It also emitted a false-positive `W015` on those files. Root cause and full detail in `@dot-agent/compiler`'s changelog; **breaking** — see below.
- The knowledge/guides MCP resources (`dot-agent://knowledge/{+name}`, `dot-agent://guides/{+name}`) matched with an `endsWith('/'+name)` heuristic that existed only to paper over the doubled paths and could resolve the wrong file when two subdirectories shared a basename. Now that the packer emits canonical paths, the lookup is an exact match against the bundle path (stripping a redundant namespace prefix from `name` first).
- This package's own `helper-src/helper.behavior` still used the pre-explicit-path bare convention (`teach "init-overview.md"`) for all 13 `teach` statements — under the new resolution model that broke `repack-helper` (and therefore `prepublishOnly`/`npm publish`) with `E018`, since the real files live under `helper-src/knowledge/`. Updated to the prefixed convention (`teach "knowledge/init-overview.md"`).
- The knowledge/guides `ResourceTemplate`s used a plain `{name}` variable, which the MCP SDK compiles to a regex that excludes `/` — structurally unable to serve a nested reference (`knowledge/sub/deep.md`), and it made `findContentFile`'s redundant-prefix handling unreachable dead code. Switched to `{+name}` (RFC 6570 reserved expansion, the one operator that permits `/` in the captured value).

### Changed
- **Breaking (via `@dot-agent/compiler`): `guide`/`teach` file references are now paths relative to the agent root**, bundled verbatim at that path — no keyword-derived foldering, no bare-filename auto-nesting under `knowledge/`. Reference content by its full path (`teach "knowledge/x.md"`). A reference resolving outside `guides/`/`knowledge/` is now reported as `W016`; one colliding with a reserved bundle path (the description file, `agent.behavior`, a merge source, or the persona) is `E020`.
- Example agents (`Text Summary`, `Fridge Assistant`) migrated to the explicit-path convention — content moved under `knowledge/` and referenced by full path; all example `.agent` bundles and `- content/` directories repacked (the shipped `Master Gardener.agent` previously carried the doubled-path bug).
- The `dot-agent://howto` resource, `SKILL.md`, and `cli-mcp.md` no longer describe a `teach`/`guide` effect's `text` as "a filename" — it's the already-prefixed bundle path, fetched via `dot-agent://<path>` directly rather than plugged into `dot-agent://knowledge/{name}`.

---

## [0.11.0] - 2026-07-14

### Fixed
- `dot-agent pack` and `dot-agent run <dir>` failed with a false-positive `E018` for any agent whose `teach`/`guide` targets lived under `knowledge/` or `guides/` — including this package's own `helper-src/`. Fixed in `@dot-agent/compiler`; see its changelog for the root cause. Until now, `npm run repack-helper` (and therefore `prepublishOnly`) could not succeed.
- The helper agent's navigable topics documented in `skills/dot-agent/SKILL.md` (`about`, `dsl`, `mcp`, `generate`, `example`) were stale relative to the live FSM since the `bb1c808` navigation flattening — the real topics from `init` are `dsl`, `gen`, `cli`, `pack`. Sending a stale-but-documented intent silently no-opped (`{"ok":true,"effects":[]}`, no error, no state change), so a client following the skill literally could get stuck with no signal anything was wrong. Corrected to match the live topics and reframed as illustrative, always deferring to a live `dot-agent://intents` read.
- The generic `dot-agent://howto` MCP resource (served by every `.agent`-powered MCP server, not just the helper — also passed as the server's `instructions` field) told an already-connected client to "run dot-agent with --helper and connect", which is circular when that client *is* already connected to the helper. It also never explained how to resolve a `teach` effect's filename into actual content. Rewritten to document `dot-agent://knowledge/{name}` resolution and to warn that valid intents are state-dependent and must be re-read after every transition, matching the intent-matching convention already described in `SKILL.md`'s Emulation Mode section (never forward a user's raw reply as the intent — match it against the current `dot-agent://intents` first).
- `dot-agent run --mcp --mcp-transport http` and `dot-agent server-mcp --mcp-transport http` failed intermittently with `Bad Request: Server not initialized` once a client stopped reusing the same TCP connection for every request (normal under HTTP keep-alive/pooling, and always the case for clients that don't pin a connection). Root cause: the local HTTP router keyed its session map by `remoteAddress:remotePort` (TCP connection identity) instead of the MCP `Mcp-Session-Id` header (session identity) — any request landing on a new TCP connection got routed to a brand-new, uninitialized transport instance. Fixed by routing on `Mcp-Session-Id`, following the MCP SDK's own reference pattern (`onsessioninitialized` populates the session map, `transport.onclose` tears it down). The one shared FSM/memory instance per running process is unchanged and intentional (see Changed below).

### Added
- `repack-helper` script, wired into `prepublishOnly`, so a stale or out-of-sync `assets/helper.agent` can never ship silently again.
- `pack` and `run` now surface `W015` for files left in `guides/`/`knowledge/` that no `guide`/`teach` statement references. Such files are **not** bundled — only linked content is packed.
- `dot-agent --help` (and the bare `dot-agent` invocation) now leads with a "Getting started" block aimed at an AI assistant doing first-time setup: the Node >=24 requirement, `dot-agent configure --claude`/`--gemini` as the recommended first command, and a reminder to reconnect the MCP session afterward — without hardcoding any topic/intent name, since those only live in the FSM and would drift again.
- `dot-agent configure` now prints an explicit reminder to restart/reconnect the MCP client after registering the new servers, since they aren't visible until the client reconnects.
- `dot-agent configure --murici` registers `dot-agent-helper` (only — not `dot-agent-dev`, whose filesystem-scaffolding tools fit an autonomous coding agent better than a human chatting in murici) in murici's own MCP client config (`~/.config/murici/mcp.json`), using its `transport: "stdio"` schema rather than claude/gemini's `command`/`args`-only shape. The interactive `configure` prompt (run with no flags) now offers Murici as a fourth target alongside Claude Code, Gemini/AGY, and "All platforms".
- `dot-agent agents list` and `dot-agent agents path <name>` expose the CLI's bundled internal `.agent` files (currently just `helper`) so other local tools can resolve an absolute path to them — e.g. `dot-agent agents path helper` — without needing to know this package's install location.

### Changed
- `assets/helper.agent` regenerated from `helper-src/`.
- `--mcp-transport http` (both `dot-agent run --mcp` and `dot-agent server-mcp`) now binds to `127.0.0.1` explicitly instead of listening on every interface by default — this is a single-machine debug tool, not something meant to be reachable from the network.
- `dot-agent run --mcp --mcp-transport http`'s ready message now states explicitly that one shared FSM/memory instance lives for the process's whole lifetime: reconnecting clients resume where they left off (the intended debug workflow — no need to re-advance the FSM after a client restart), but concurrent distinct clients drive the same conversation. This was already the behavior; it just wasn't documented anywhere a client would see it at runtime.
- `configure.ts`'s per-target logic (MCP config path/shape, skill destination) was consolidated from five separate hardcoded branches into a small target-definition table, since `murici` needed a genuinely different MCP entry shape rather than just a different file path. The `configure` result's MCP-registration message now lists which servers were actually registered instead of a hardcoded "(helper and dev)", since murici only gets `dot-agent-helper`.
- Build tooling migrated from `tsup` to `tsdown`; upgraded to TypeScript 7. No output-shape change.
- `@dot-agent/compiler` and `@dot-agent/sdk` pins bumped to `0.10.1` and `0.10.2` respectively, to pick up their own fixes from this release round.

### Documentation
- `README.md` and the helper's own knowledge (`helper-src/knowledge/pack.md`, `dsl-overview.md`) now state the linked-only rule: a file in `guides/`/`knowledge/` is packed only when the behavior names it, and an unreferenced one is reported (`W015`) and left out. An unreferenced file would be unreachable at runtime anyway — the host only ever learns a filename from a `teach` effect, and there is no way to list the knowledge directory.

---

## [0.10.0] - 2026-07-10

- First public release on npm. See repository history for prior development.
