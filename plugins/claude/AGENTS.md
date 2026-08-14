# plugins/claude — agent guidelines

The Claude Code plugin for dot-agent. [README.md](README.md) is what it bundles, and why.

**This file does not load, and that is deliberate — do not give it a `CLAUDE.md`.** The folder is copied
verbatim into every user's plugin cache, so a `CLAUDE.md` at a plugin root would ship to them while never
loading as project context, and `claude plugin validate` warns about exactly that. The guardrails that
must fire *while* someone edits here live in
[`.agents/rules/plugin-claude.md`](../../.agents/rules/plugin-claude.md) — `paths`-scoped to this folder,
outside the shipped tree, and therefore actually reaching context. **Read that rule first; it is the
authority.** What follows is only what it deliberately leaves out.

## `plugin.json`

`mcpServers` is the only functional key — `dot-agent` and `dot-agent-helper`. Skills carry **no manifest
entry at all**: they are auto-discovered from `skills/`, so adding one is adding a folder. There are no
`hooks`; read [DA00-07](../../project/adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md) decision 4
before adding any.

## Verifying the byte-identity invariant

The rule states that `skills/run/SKILL.md` must stay identical to the CLI's copy. The check itself:

```bash
diff plugins/claude/skills/run/SKILL.md apps/dot-agent-cli/skills/run/SKILL.md
```

Both mirror [`dsl/reference/comportment.md`](../../dsl/reference/comportment.md), which is the canonical
transport-neutral spec and the thing that actually changed if these two disagree. `skills/test/SKILL.md`
is outside the invariant on purpose — it points back at the Mode A skill rather than restating
comportment, so it has nothing that could drift.

## Design and status

| What | Where |
|---|---|
| The decision, and why the runtime is not bundled | [DA00-07](../../project/adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md) — its Related section breadcrumbs the long-form log |
| Work items and current state | [`project/plans/002`](../../project/plans/002-dot-agent-as-claude-plugin.md), tracked as `platform#13` |

## Keeping this file current

Updating it is part of any task that changes what ships in this folder. Triggers: a manifest key is added
or stops being used; a skill folder appears; the relationship between the two `SKILL.md` copies changes;
something here starts being duplicated by the rule, which is the one that loads and therefore wins.
