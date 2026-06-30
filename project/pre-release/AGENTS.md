# AGENTS.md — pre-release/

## What this folder is

**Long-form incubation logs** for the pre-v1.0 era — the rich context behind decisions: AI
collaboration, dead-ends, deep brainstorms. They are the *appendices* to the terse ADRs in
[`../adr/`](../adr/). The scheme is defined in [`../adr/DA00-01-traceability-scheme.md`](../adr/DA00-01-traceability-scheme.md);
see also [`../../GOVERNANCE.md`](../../GOVERNANCE.md) § Pre-1.0 Incubation.

## ⚠️ Not spec truth

These logs are **historical context**, not current behavior. They capture how a decision was reached at
a point in time and may reference syntax or bugs since changed. The source of truth is the ADR (for the
decision), `../../dsl/` (for the language), and `../../packages/` (for the code). Do not cite a log as
current behavior.

## Structure

```
pre-release/
├── AGENTS.md
└── v<minor>/                      ← one subfolder per pre-1.0 minor (v0.1, v0.2, …)
    └── DA0N-<seq>-<slug>.md       ← long-form log, matching its ADR's ID
```

## Rules

- A log is **optional** — only write one when a decision has context worth preserving beyond the ADR.
  Most ADRs need no log, so numbering here is **gappy by design**.
- **Match the ADR's ID** (`DA0N-<seq>`) and **link bidirectionally**: the ADR's `Related` section points
  to the log, and the log points back to its ADR.
- Logs are **write-once** historical records — do not retro-edit them as decisions evolve. A superseding
  decision gets its own ADR (and optionally its own log).
- No community review; these are for the maintainer and LLM agents.
