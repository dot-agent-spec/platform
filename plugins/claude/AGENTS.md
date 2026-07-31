# plugins/claude — agent guidelines

Claude Code plugin for dot-agent. See [README.md](README.md) for what it bundles and why.

**There is deliberately no `CLAUDE.md` here — do not add one.** This folder is copied verbatim into every
user's plugin cache (no build, no allowlist), and a `CLAUDE.md` at a plugin root ships to them while never
loading as project context; `claude plugin validate` warns about it. The guardrails below are mirrored into
[`.agents/rules/plugin-claude.md`](../../.agents/rules/plugin-claude.md), which is `paths`-scoped to this
folder, lives outside the shipped tree, and is what actually reaches context.

## Source of truth for `skills/run/SKILL.md`

This skill's comportment rules (Mode A: embody + drive an agent) must match
[`dsl/reference/comportment.md`](../../dsl/reference/comportment.md) — the canonical,
transport-neutral spec — and the CLI's own copy at
[`apps/dot-agent-cli/skills/run/SKILL.md`](../../apps/dot-agent-cli/skills/run/SKILL.md).
All three drift-prone copies must move together. When `comportment.md` changes, update this file's
`SKILL.md` and the CLI's in the same change — do not let this copy fall behind.

The two `SKILL.md` copies are kept **byte-identical** (`comportment.md` is the subset they share; the
`SKILL.md`s add Step 0, the CLI command list, and the authoring sections on top). Verify with:

```bash
diff plugins/claude/skills/run/SKILL.md apps/dot-agent-cli/skills/run/SKILL.md
```

## No bundled runtime

This plugin deliberately ships **no copy of the runtime** — not a Bun-compiled binary, not a vendored
`dist/cli.mjs`. It shells out to the globally-installed `dot-agent` CLI, which the skill's Step 0
installs on first use. A second copy of the runtime inside the plugin would drift from the published
package. See [DA00-07](../../project/adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md) decision 2
before reversing this — the rule generalizes to every future host plugin, not just this one.

## `skills/test` (Mode B) — plugin-only, no CLI mirror

Unlike `skills/run`, this one has **no counterpart under `apps/dot-agent-cli/skills/`** and isn't
part of the byte-identity invariant above. It's a thin delta skill: it points back at `/dot-agent:run`
for comportment instead of restating it, so there's nothing here that could drift from
`comportment.md` in the first place. Keep it that way — if you find yourself copying comportment rules
into it, stop and link to the Mode A skill instead.

## `plugin.json`

Only `mcpServers` (`dot-agent` + `dot-agent-helper`) and `skills` (auto-discovered from `skills/`) are
declared. No `hooks` yet — see the [DA00-07 log](../../project/pre-release/v0.1/DA00-07-plugin-packaging-across-llm-cli-hosts.md)'s
decision 4 before adding one.

## Full design and status

Decision: [`DA00-07`](../../project/adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md) + its
[log](../../project/pre-release/v0.1/DA00-07-plugin-packaging-across-llm-cli-hosts.md) (design
rationale). Work items and current status: [`project/plans/002-dot-agent-as-claude-plugin.md`](../../project/plans/002-dot-agent-as-claude-plugin.md)
— tracker: `dot-agent-spec/platform#13`.
