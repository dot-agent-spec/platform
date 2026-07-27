<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-DA00-07: Package dot-agent as a Portable Plugin Across LLM Coding-Agent CLI Hosts

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-07-27 |
| Deciders | Danilo Borges |

---

## Context

Driving a `.agent` — "load this agent and follow its flow" — requires a host-specific integration: the
LLM coding-agent CLI that the human is already using needs to auto-register dot-agent's tools and load
the canonical comportment (`dsl/reference/comportment.md`) the moment it starts a session. Claude Code
is the first host; Codex and Antigravity (`agy`) are already anticipated next — `apps/agy/` is reserved
in this repo's layout as the Antigravity integration point. Each host has its own extension mechanism
(Claude Code: a plugin manifest with `mcpServers` + `skills`; Codex and Antigravity: their own,
independently evolving), so "add a new host" recurs, and the first implementation (`plugins/claude/`,
`project/tasks/DA00-07-dot-agent-claude-skill.md`) sets the pattern every later one either follows or has to
diverge from on purpose.

## Decision

We will treat "driving surface" as a first-class, **per-host plugin** under `plugins/<host>/`, each one
a thin, host-native adapter around two things that stay shared and unchanged across hosts: the canonical
comportment contract (`dsl/reference/comportment.md`) and the single globally-installed `@dot-agent/cli`
(never a vendored copy — see the runtime-substrate rationale carried in this ADR's paired log). A host
plugin's own content is limited to what is genuinely host-specific: its manifest/auto-registration
mechanism, and a skill file that mirrors `comportment.md` plus that host's own bootstrap step (installing
the CLI on first use). `plugins/claude/` is the reference implementation; a Codex or Antigravity plugin
is expected to reuse this shape rather than invent its own.

## Options considered

- **Option A — One-off integration per host, whatever's fastest each time.** Pro: no upfront design
  cost. Con: without a shared contract, each host's comportment text drifts independently — this is
  exactly the failure mode `comportment.md` was extracted to prevent (see the agy role-confusion bug
  documented in `project/tasks/DA00-07-dot-agent-claude-skill.md`). (rejected)
- **Option B — Wait for / adopt a single cross-host plugin standard.** Pro: write the integration once.
  Con: no such standard exists across Claude Code, Codex, and Antigravity today; blocking on one would
  stall shipping against the host that already works. (rejected)
- **Option C (chosen) — Shared behavioral core, thin host-specific adapters.** `comportment.md` stays
  the single transport- and host-neutral contract; each `plugins/<host>/` is a small adapter that mirrors
  it plus that host's own manifest mechanics. Pro: ships today against Claude Code without waiting on any
  cross-host agreement; adding a host later is "write one more thin adapter," not a redesign. Con: N
  adapters to keep in sync by hand — mitigated by the byte-identity check already established between
  the Claude plugin's skill and the CLI's own mirrored copy (`plugins/claude/AGENTS.md`).

## Consequences

Adding Codex or Antigravity support becomes "add `plugins/<host>/` mirroring `comportment.md` and the
CLI's Step-0 bootstrap," not a redesign of the runtime or the comportment contract — `apps/agy/` can
graduate from its current reserved, aspirational entry into a real implementation of this same pattern.
`comportment.md`'s "single source of truth" callout becomes more load-bearing as more surfaces cite it,
so a change there now has to be propagated to every existing adapter, not just one. The
single-globally-installed-CLI rule (no vendored runtime) generalizes to every host plugin, not just
Claude's — a future host adapter that vendors its own copy of the CLI would be a deviation from this
decision, not a new default.

## Related

- [`dsl/reference/comportment.md`](../../dsl/reference/comportment.md) — the shared contract this ADR
  keeps host-neutral.
- [`project/tasks/DA00-07-dot-agent-claude-skill.md`](../../project/tasks/DA00-07-dot-agent-claude-skill.md) — the
  Claude Code reference implementation this ADR generalizes from.
- Paired long-form log: [`project/pre-release/v0.1/DA00-07-plugin-packaging-across-llm-cli-hosts.md`](../pre-release/v0.1/DA00-07-plugin-packaging-across-llm-cli-hosts.md).
