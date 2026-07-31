# apps/dot-agent-cli — agent guidelines

The `dot-agent` developer CLI: scaffolds, lints, packs and runs `.agent` projects, and hosts the MCP
servers the Claude Code plugin declares. [README.md](README.md) is the user-facing command reference —
read it rather than restating it here, and `src/commands/` is the definitive list.

## Layout — the folders whose contents are not what they look like

| Path | What is non-obvious about it |
|---|---|
| `assets/helper.agent` | **Generated.** Built from `helper-src/` by `npm run repack-helper`; editing it by hand is lost on the next pack |
| `helper-src/` | A real `.agent` project whose prose nothing validates — see below |
| `templates/` | The scaffold `init` copies. `init.ts` walks it with `readdir`, no file list, so **anything added here lands in every user's new project** |
| `skills/run/SKILL.md` | Byte-identical twin of the plugin's copy — see below |
| `.githooks/` | Present but never invoked — see below |

## How this works

**`helper-src/` is free-form prose that nothing checks.** Its `.md` files teach a driving LLM how to write
`.description`/`.behavior`, and no parser validates those claims against the real grammar, lint codes or
command surface — a renamed flag leaves the helper teaching the old shape indefinitely. The
[`cli-helper-agent-sync`](../../.agents/agents/cli-helper-agent-sync.md) subagent exists to close that gap
and carries the verified ground-truth list; run it after any grammar, lint-code or command-surface change.
Two of its rules are easy to get wrong: prove a syntax claim by linting a throwaway agent rather than by
reading the reference, and keep the helper a photograph of the present — no version narrative, and never
name a construct in order to exclude it.

**`skills/run/SKILL.md` must stay byte-identical to
[`plugins/claude/skills/run/SKILL.md`](../../plugins/claude/skills/run/SKILL.md)**, both mirroring
[`dsl/reference/comportment.md`](../../dsl/reference/comportment.md). They are real files in two trees, not
symlinks: the plugin folder has to stand alone to be installable from the marketplace. Edit both, then
`diff` them — nothing fails if you edit only one.

**Two MCP servers, not one.** `run --mcp` / `run --helper` starts `startMcpServer` → `registerRuntime()`
only. `server-mcp.ts` registers four authoring tools **and** calls `registerRuntime()`. `registerRuntime()`
is `registerLoadTool` (`load_agent`) + the five session tools + `registerResources` — reading only
`registerTools()` undercounts. Prose saying "MCP server mode" means the first one.

**`configure --claude` installs the host's plugin; it doesn't write config for it anymore.** Per
[ADR-DA00-08](../../project/adr/DA00-08-cli-installs-native-host-plugins.md), `configure.ts`'s `claude`
target shells out via `src/host-command.ts` (`runHostCommand`, wrapping `node:child_process.execFile`) to
`claude plugin marketplace add`/`install`, then calls `removeLegacyMcpEntries` to delete any
`dot-agent`/`dot-agent-helper`/`dot-agent-dev` entries an older CLI wrote into `~/.claude.json` — that file
is delete-only from this code now, never created or blind-overwritten (a JSON parse failure throws instead
of silently replacing the file, since it holds the host's entire user state, not just `mcpServers`). Only
`gemini`/`murici` still take the direct-file-write path (`ConfigureTarget`'s `FileTarget` arm), because
neither has a dot-agent plugin format yet. `SERVERS`/`SERVER_NAMES` (exported from `configure.ts`) must
keep matching `plugins/claude/.claude-plugin/plugin.json`'s own `mcpServers` —
`tests/plugin-manifest-parity.test.ts` is the only thing that checks that.

**The license-header hook does not run, despite appearances.** `package.json`'s `prepare` runs
`git config core.hooksPath .githooks`, which writes repository-level config resolving from the **repo
root** — so `npm install` here silently repoints the whole monorepo's hooks, and `apps/dot-agent-cli/.githooks/pre-commit`
is never invoked. Apply headers by running `scripts/ensure-license-headers.sh` yourself; every `.ts` file
carries the full Apache 2.0 header, and an existing copyright notice is never altered.

**Publishing is triggered by pushing a `cli@*` tag**, which runs
[`publish-ts.yml`](../../.github/workflows/publish-ts.yml) with npm OIDC. Creating a GitHub Release
publishes nothing, and `npm publish` is never run by hand. Version bumps across `@dot-agent/*` are an
exact-pin cascade — use the `/publish` skill, which owns it.

## Source of truth

| What | Where |
|---|---|
| Command set, flags, argument shape | `src/commands/*.ts` — code wins over any prose |
| What the helper teaches | `helper-src/`, guarded by the `cli-helper-agent-sync` subagent |
| Comportment for driving an agent | [`dsl/reference/comportment.md`](../../dsl/reference/comportment.md) |
| Release procedure | [`publish-ts.yml`](../../.github/workflows/publish-ts.yml) + the `/publish` skill |

## Keeping this file current

Fold the update into whatever task exposed the drift — do not leave it for a sweep.

- A folder appears whose contents are not what its name suggests → add a Layout row; a folder stops being
  surprising → drop its row. Ordinary folders do not earn one.
- An invariant above stops being true — the hook gets wired correctly, the two `SKILL.md` copies become a
  symlink or a checked guard, `init` gains an explicit file list — **delete that section**. A guard that
  now exists mechanically must not also live here as prose.
- The MCP registration split changes, or a server gains tools → correct the composition line.
- The release trigger or tag pattern changes → correct it here and in `/publish`.
- A document lands here that this package does not own → move it out rather than describing it; a folder
  is not a filing cabinet for whatever shares its parent.
