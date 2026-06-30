<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-0003: Markdown-only format for skill definitions

| Field | Value |
|---|---|
| Status | Superseded |
| Date | 2026-06-23 |
| Deciders | Danilo Borges |
| Superseded by | ADR-0004 |

---

## Context

Skills are the reusable, invocable units of behavior in this project — slash commands like `/new-rfc`,
`/new-adr`, and `/sync-implementation-status` that agents execute on demand. Each skill needs a machine-
readable metadata header (name, description, arguments, effort, model flags) and a body that tells the
executing agent what to do step by step.

Two broad approaches existed: a structured serialization format (code-like — YAML blocks, JSON schemas,
or a custom DSL specifying actions and outputs) or a document format (Markdown prose with YAML
frontmatter for the metadata). The choice had to be made before the first skill shipped, because
changing it later would require migrating all existing skills.

## Decision

We will define skills as `SKILL.md` Markdown files with YAML frontmatter for machine-readable metadata
and freeform Markdown prose for the step-by-step instructions the executing agent follows.

## Options considered

- **Option A — Structured code format (YAML/JSON/custom DSL)** — Pro: fully machine-parseable;
  tooling can validate step completeness and argument usage automatically. Con: introduces a schema to
  maintain; instructions expressed as structured data are harder to read and write than prose; small
  models struggle to interpret densely structured configs as action sequences.

- **Option B — Markdown with YAML frontmatter (chosen)** — Pro: instructions are plain prose that any
  model size can follow without a parser; frontmatter gives tooling the machine-readable contract it
  needs (description, arguments, flags); consistent with the project's existing documentation format;
  zero new tooling required. Con: skill bodies are free-form — there is no schema to validate that all
  required sections are present or that step numbering is consistent.

- **Option C — Full DSL skill format (`.behavior`-style)** — Pro: maximum expressiveness; explicit
  state transitions enable formal analysis. Con: overkill for what are essentially instruction
  documents; skills do not need a runtime to execute — they are read by a model at invocation time;
  adds a compile/lint step to the skill authoring loop with no meaningful benefit at this granularity.

## Consequences

- **Easier:** skills are readable and writable by any contributor familiar with Markdown; no separate
  skill parser is needed; checklist-driven steps work naturally as Markdown ordered lists; the skill
  format is self-documenting.
- **Accepted costs:** free-form prose makes it impossible to statically validate step completeness
  or enforce structural conventions beyond the frontmatter; quality depends on prose discipline.
- **Follow-up:** establish a per-skill checklist convention (each `SKILL.md` ends with a `## Checklist`
  section) to partially compensate for the lack of structural validation — see `/new-rfc` and
  `/new-adr` as the canonical exemplars.

## Related

- [`GOVERNANCE.md`](../GOVERNANCE.md) — process context
- [ADR-0002](0002-model-tiering-for-agent-routing.md) — references `model:` and `effort:` in SKILL.md frontmatter
- `.claude/skills/new-rfc/SKILL.md` and `.claude/skills/new-adr/SKILL.md` — canonical skill exemplars
