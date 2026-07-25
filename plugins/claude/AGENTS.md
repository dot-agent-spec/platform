# plugins/claude — agent guidelines

Claude Code plugin for dot-agent. See [README.md](README.md) for what it bundles and why.

## Source of truth for `skills/dot-agent/SKILL.md`

This skill's comportment rules (Mode A: embody + drive an agent) must match
[`dsl/reference/comportment.md`](../../dsl/reference/comportment.md) — the canonical,
transport-neutral spec — and the CLI's own copy at
[`apps/dot-agent-cli/skills/dot-agent/SKILL.md`](../../apps/dot-agent-cli/skills/dot-agent/SKILL.md).
All three drift-prone copies must move together. When `comportment.md` changes, update this file's
`SKILL.md` and the CLI's in the same change — do not let this copy fall behind.

The two `SKILL.md` copies are kept **byte-identical** (`comportment.md` is the subset they share; the
`SKILL.md`s add Step 0, the CLI command list, and the authoring sections on top). Verify with:

```bash
diff plugins/claude/skills/dot-agent/SKILL.md apps/dot-agent-cli/skills/dot-agent/SKILL.md
```

## No bundled runtime

This plugin deliberately ships **no copy of the runtime** — not a Bun-compiled binary, not a vendored
`dist/cli.mjs`. It shells out to the globally-installed `dot-agent` CLI, which the skill's Step 0
installs on first use. A second copy of the runtime inside the plugin would drift from the published
package. See the plan doc's settled decision 2 before reversing this.

## `plugin.json`

Only `mcpServers` (dev + helper) and `skills` (auto-discovered from `skills/`) are declared. No
`hooks` yet — see the plan doc's "Prompt-tick hook — deferred out of v1" section before adding one.

## Full plan

[`project/tasks/dot-agent-claude-skill.md`](../../project/tasks/dot-agent-claude-skill.md) —
tracker: `dot-agent-spec/platform#13`.
