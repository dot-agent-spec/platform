<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# ADR-0004: Skill checklist as a required convention

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-06-23 |
| Deciders | Danilo Borges |
| Supersedes | ADR-0003 |

---

## Context

ADR-0003 chose Markdown as the format for skill definitions and noted as a follow-up that a per-skill
checklist convention should be established to compensate for the lack of structural validation in
free-form prose. Both `/new-rfc` and `/new-adr` already ship with a `## Checklist` section at the
bottom of each `SKILL.md`. The question is whether this is optional best practice or a hard convention
enforced as part of the skill authoring standard.

The absence of a clear rule has created ambiguity: new skill authors may not know whether a checklist
is expected, and skills without one give a small model no structured way to self-verify completeness
before reporting done.

## Decision

We will require a `## Checklist` section as the final section of every `SKILL.md`. Each checklist item
must be a markdown checkbox (`- [ ] …`) verifiable by the executing model before the skill reports
done.

## Options considered

- **Option A — Optional best practice** — Pro: no enforcement burden; authors who don't need a
  checklist are not forced to write one. Con: inconsistent skills; small models have no predictable
  self-verification point; the follow-up from ADR-0003 remains unresolved.

- **Option B — Required section, no schema (chosen)** — Pro: every skill has a self-verification point;
  small models can always look for `## Checklist` to find the done criteria; consistent author
  experience across all skills; zero tooling required to enforce (code review is sufficient). Con:
  authors must write a checklist even for trivial skills; the rule cannot be auto-enforced without
  a skill linter.

- **Option C — Enforced by skill linter** — Pro: automatic validation prevents non-compliant skills.
  Con: requires building a skill linter that understands SKILL.md structure — significant overhead for
  a convention that can be enforced by code review at the current team size.

## Consequences

- **Easier:** every SKILL.md has a predictable self-verification section; onboarding new skill authors
  is simpler (one clear rule); small-model runs have a structured final gate.
- **Accepted costs:** trivial skills must include a checklist even when the steps are self-evident;
  enforcement relies on review discipline, not tooling.
- **Follow-up:** add a checklist-present check to any future skill linter.

## Related

- [ADR-0003](0003-markdown-only-format-for-skill-definitions.md) — the format decision this refines
- `.claude/skills/new-rfc/SKILL.md` and `.claude/skills/new-adr/SKILL.md` — canonical exemplars
