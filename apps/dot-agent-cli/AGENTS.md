# apps/dot-agent-cli — agent guidelines

The `dot-agent` developer CLI: scaffolds, lints, packs and runs `.agent` projects, and hosts the two
MCP servers the Claude Code plugin declares. See [README.md](README.md) for the user-facing command
reference.

## Layout

| Path | What it is |
|---|---|
| `src/cli.ts` + `src/commands/*.ts` | The commands: `init`, `run`, `pack`, `unpack`, `configure`, `agents`, `mcp-run`, `server-mcp` |
| `helper-src/` | Source of the interactive helper agent — itself a `.agent` project |
| `assets/helper.agent` | **Generated.** Built from `helper-src/` by `npm run repack-helper`; never edit by hand |
| `skills/run/SKILL.md` | The Mode A skill `configure --claude` installs |
| `templates/` | The scaffold `init` copies — every file here lands in a user's new project |
| `tests/` | Vitest suites |

## Two MCP servers, not one

`run --mcp` / `run --helper` starts `startMcpServer` → `registerRuntime()` only. `server-mcp.ts`
registers four authoring tools (`dot_agent_init`/`_pack`/`_unpack`/`_configure`) **and** calls
`registerRuntime()`. `registerRuntime()` is `registerLoadTool` (`load_agent`) + the five session tools
(`send_intent`, `send_event`, `send_offtopic`, `tick_prompt`, `inject_memory`) + `registerResources`.
Reading only `registerTools()` undercounts. Prose saying "MCP server mode" means the first one.

## Invariants worth guarding

**`skills/run/SKILL.md` is byte-identical to
[`plugins/claude/skills/run/SKILL.md`](../../plugins/claude/skills/run/SKILL.md)**, and both mirror
[`dsl/reference/comportment.md`](../../dsl/reference/comportment.md), the canonical transport-neutral
spec. They are real files in two trees, not symlinks — the plugin folder has to stand alone to be
installable from the marketplace. Edit both, then prove it:

```bash
diff apps/dot-agent-cli/skills/run/SKILL.md plugins/claude/skills/run/SKILL.md
```

**`helper-src/` is free-form prose that nothing validates.** Its `.md` files teach a driving LLM how to
write `.description`/`.behavior`, and no parser checks those claims against the real grammar, lint codes
or CLI surface — a renamed flag or lint code leaves the helper teaching the old shape indefinitely. The
`cli-helper-agent-sync` subagent (`.agents/agents/`) exists to close that gap; it carries the verified
ground-truth list and the traps found so far. Run it after any grammar, lint-code or command-surface
change. Two rules it enforces that are easy to get wrong: prove every syntax claim by linting a
throwaway agent rather than by reading the reference, and keep the helper a photograph of the present —
no version narrative, no naming a construct in order to exclude it.

## Templates ship to users

Everything under `templates/` is copied verbatim into a scaffolded project by `init`, which walks the
tree with `readdir` rather than an explicit file list. An empty or placeholder file here becomes an
empty file in every new user project, so add one only when it carries real content.

## Releasing

Publishing is triggered by **pushing a tag** matching `cli@*`, which runs
[`publish-ts.yml`](../../.github/workflows/publish-ts.yml) with npm OIDC trusted publishing. Creating a
GitHub Release does not publish anything, and `npm publish` is never run by hand. The version bump order
across `@dot-agent/*` matters — use the `/publish` skill, which owns the exact-pin cascade.

## License headers

Every `.ts` file carries the full Apache 2.0 header, sole copyright Danilo Borges 2026.
`scripts/ensure-license-headers.sh` applies them — run it before committing rather than assuming a hook
has. Never remove or alter an existing copyright notice.
