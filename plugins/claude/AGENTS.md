# plugins/claude — agent guidelines

Claude Code plugin for dot-agent. See [README.md](README.md) for what it bundles and why.

## Source of truth for `skills/dot-agent/SKILL.md`

This skill's comportment rules (Mode A: embody + drive an agent) must match
[`dsl/reference/comportment.md`](../../dsl/reference/comportment.md) — the canonical,
transport-neutral spec — and the CLI's own copy at
[`apps/dot-agent-cli/skills/dot-agent/SKILL.md`](../../apps/dot-agent-cli/skills/dot-agent/SKILL.md).
All three drift-prone copies must move together. When `comportment.md` changes, update this file's
`SKILL.md` and the CLI's in the same change — do not let this copy fall behind.

## `plugin.json`

Only `mcpServers` (dev + helper) and `skills` (auto-discovered from `skills/`) are declared. No
`hooks` yet — see the plan doc's "Prompt-tick hook — deferred out of v1" section before adding one.

## Full plan

[`project/tasks/dot-agent-claude-skill.md`](../../project/tasks/dot-agent-claude-skill.md) —
tracker: `dot-agent-spec/platform#13`.
