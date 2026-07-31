---
description: Invariants for the Claude Code plugin under plugins/claude — the folder ships verbatim to users, and its SKILL.md is one of two copies that must move together
paths: ["plugins/claude/**", "apps/dot-agent-cli/skills/**"]
---

## plugins/claude — what the folder being shipped verbatim implies

Full detail: [`plugins/claude/AGENTS.md`](../../plugins/claude/AGENTS.md). These are the parts that must
fire *while* you edit, not when someone thinks to open that file.

**The folder is the distribution.** A Claude Code plugin has no build, no `dist`, no `files` allowlist —
`plugin.json` carries no packaging field at all. Whatever sits under `plugins/claude/` is copied byte for
byte into every user's `~/.claude/plugins/cache/`. So:

- **Never put a `CLAUDE.md` at the plugin root.** It would ship to users and never load — a plugin root is
  not project context, and `claude plugin validate` warns about exactly this. That is why this rule exists
  instead: it lives outside the shipped folder and actually loads.
- Nothing repo-internal belongs in there — no notes, no scratch, no analysis. If it is not part of what a
  user installs, it goes somewhere else in the repo.

**`skills/run/SKILL.md` exists twice.** It must stay byte-identical to
[`apps/dot-agent-cli/skills/run/SKILL.md`](../../apps/dot-agent-cli/skills/run/SKILL.md), both mirroring
[`dsl/reference/comportment.md`](../../dsl/reference/comportment.md). They are real files in two trees, not
symlinks — the plugin folder has to stand alone to be installable. **Edit both, then
`diff plugins/claude/skills/run/SKILL.md apps/dot-agent-cli/skills/run/SKILL.md`**; nothing fails if you
edit only one. `skills/test/SKILL.md` is deliberately *not* part of this pair: it points back at the Mode A
skill for comportment rather than restating it, and must stay that way.

**No bundled runtime.** The plugin ships no copy of the runtime — not a compiled binary, not a vendored
`dist/cli.mjs`. `mcpServers.command` is the PATH-resolved `dot-agent`, installed on first use. Read
[DA00-07](../../project/adr/DA00-07-plugin-packaging-across-llm-cli-hosts.md) decision 2 before reversing
this; the rule generalizes to every future host plugin, not just this one.

**Skill folders are named for the verb they perform** (`run`, `test`) — never for the plugin, or the
invocation stutters into `/dot-agent:dot-agent`.
