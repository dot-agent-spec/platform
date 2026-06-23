# Brief — Author the `/new-adr` skill

> **For the operator:** open a Claude Code session on the `dot-agent-spec` repo, model **Sonnet**, and
> point it at this brief. Sibling of `/new-rfc` and `/sync-implementation-status`. The skill's real
> output is an ADR under `adr/`; any dogfood/analysis output for this brief goes in **`dogfood/new-adr/`**
> (this folder).

## Dogfood folder convention (read `dogfood/AGENTS.md` first)

Each dogfood lives in `dogfood/<skill-name>/` with this `BRIEF.md`, the `.behavior`/`.description`
artifacts, and an `EXPRESSIVENESS.md`. Two rules govern your work here:

- **Work in isolation.** Report *your own* firsthand experience only. **Do not read other `dogfood/*`
  folders** — an independent view is the point; cross-reading biases the result and breaks the recurrence
  signal the maintainer relies on.
- **Point-in-time snapshot.** Your `EXPRESSIVENESS.md` is dated and write-once — a usability snapshot,
  **not** spec truth (it may describe behavior that later gets fixed). Do not update or reconcile earlier
  dogfoods. The maintainer consolidates across folders later; a gap recurring in several independent
  dogfoods carries more weight.

Every `EXPRESSIVENESS.md` includes a standard section **"Parser & linter error-message quality"**
populated **only with errors you hit firsthand** (exact message + the clearer author-facing message that
would have helped).

## Context

We added the ADR system: `adr/AGENTS.md`, `templates/adr.md`, and the records `adr/0001-two-axis-versioning.md`
and `adr/0002-model-tiering-for-agent-routing.md`. This skill makes creating the next ADR a one-command,
convention-correct action. An ADR records **one** hard-to-reverse decision ("we chose X, because Y, and
accept Z") — smaller grain than an RFC, and **immutable once Accepted**. Unlike `/new-rfc`, an ADR has
**no package-impact table**, and it has a supersession mechanism.

## Read first (ground truth)

- `adr/AGENTS.md` — ADR lifecycle, immutability, supersession workflow.
- `templates/adr.md` — exact structure (metadata → Context → Decision → Options considered → Consequences → Related) and the Apache license block.
- `adr/0001-two-axis-versioning.md` and `adr/0002-model-tiering-for-agent-routing.md` — canonical exemplars; match tone/depth. (0002 also shows a `Sunset & reversal` section for decisions expected to expire.)
- `GOVERNANCE.md` — where ADRs sit relative to RFCs and tasks.

## Deliverable 1 — the skill `/new-adr`

A `SKILL.md` (+ helper if needed) that, given a decision topic, produces `adr/<NNNN>-<slug>.md` from
`templates/adr.md`:

1. **Collect inputs:** the decision (short noun phrase); whether it **supersedes** an existing ADR. Ask if not passed as an argument.
2. **Next number:** scan `adr/*.md` for the highest `NNNN`, +1, zero-padded. Start at `0001` if none. Deterministic command, no guessing.
3. **Date:** `date +%Y-%m-%d` — never let the model guess it.
4. **Scaffold from `templates/adr.md`:** keep the license block; delete all guidance HTML comments; heading `# ADR-<NNNN>: <decision noun phrase>`.
5. **Status:** default `Accepted` (the decision was made). Use `Proposed` only if the user says the record is being circulated before ratification — explain this default, it is the common confusion.
6. **Fill the body:** Context (forces/constraints, for a newcomer); Decision (active voice, one decision); Options considered (alternatives + trade-offs, **including rejected ones and why** — the judgment-intensive part); Consequences (easier AND harder/accepted; follow-ups); Related. If the decision is expected to expire, add a `Sunset & reversal` section like ADR-0002.
7. **Supersession:** if it supersedes ADR-MMMM, set this ADR's `Supersedes` to ADR-MMMM **and** edit `adr/MMMM-*.md` to set its `Superseded by` to this ADR and `Status` to `Superseded`. **Never** touch the superseded ADR's body — only those two header fields.
8. No ADR index file exists — the `adr/` folder listing is the index. If one is added later, add an index step.

Explicit, checklist-driven steps so a small model can run it reliably. Side-effecting (creates/edits files) → set `disable-model-invocation: true`. Do not hardcode a model (see model-routing note).

## Deliverable 2 — DSL dogfood in `dogfood/new-adr/` + `EXPRESSIVENESS.md`

**Attempt the DSL dogfood even though `/new-adr` is markdown tooling** — the point is a usability test of
the spec *at this moment*: can the DSL even express this flow? Model the "create an ADR" workflow as
`adr-author.description` + `adr-author.behavior` in this folder (states like: collect decision → draft
sections → confirm supersession → emit). Lint with `@dot-agent/compiler` (`full.lintBehavior` /
`lintDescription`); iterate until clean. Do **not** depend on the kernel; do **not** pack.

Then write `dogfood/new-adr/EXPRESSIVENESS.md` (start with the dated snapshot banner — see
`dogfood/AGENTS.md`):

- **What expressed cleanly** and **Gaps & limitations** — each gap labeled a `task` or `RFC` candidate.
- The standard **"Parser & linter error-message quality"** section — only DSL errors you hit firsthand
  (exact message + clearer author-facing message).
- **Isolation:** base everything on *your* run. Do not read or import from other `dogfood/*` folders.

## Constraints

- Match `adr/0001`/`0002` conventions exactly (license block, headers, depth, tone).
- One source of truth — reuse `templates/adr.md`; do not duplicate its structure into the skill.
- Immutability is sacred: never rewrite the body of an Accepted ADR.

## Definition of done

- `/new-adr <sample decision>` produces a correct `adr/<NNNN>-<slug>.md` born `Accepted`.
- A supersession run updates both the new and old ADR's header fields (and nothing else).
- A small-model run still yields a valid, convention-correct ADR (report the result).
- `dogfood/new-adr/` has `adr-author.{behavior,description}` (lint-clean) and a dated `EXPRESSIVENESS.md` with your firsthand gaps + the standard error-message section, written in isolation.

## Model-routing note

`SKILL.md` frontmatter supports `model`, `effort`, `context: fork`, `agent` (ref:
https://code.claude.com/docs/en/skills). The judgment-intensive step is **Options considered** — keep it
a clean seam routable to a stronger model; scaffolding/field-filling can run cheap. Default `inherit`.
See [ADR-0002](../../adr/0002-model-tiering-for-agent-routing.md).
