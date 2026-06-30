# AGENTS.md — dogfood/

## What this folder is

Point-in-time **usability tests of the dot-agent DSL**. For each skill or workflow, an agent models it as
`.behavior` / `.description` and records where the language helped or got in the way. The goal is to feel
the spec from an author's seat **at the moment of generation** — not to maintain living documentation.

## ⚠️ If you are NOT doing a dogfood, ignore this folder

These files are **NOT spec truth.** They are dated snapshots that may describe bugs already fixed or
syntax already changed. **Never cite a `dogfood/*` file as current behavior**, and do not let one steer a
decision in other work. The source of truth for the language is [`../dsl/`](../dsl/) (reference) and
[`../packages/`](../packages/) (code). If a grep surfaced something here, treat it as historical.

## Structure

```
dogfood/
└── <skill-name>/
    ├── BRIEF.md            ← the task that produced this dogfood
    ├── <name>.behavior     ← the modeled flow (lint-only; never packed or run)
    ├── <name>.description
    └── EXPRESSIVENESS.md    ← dated, write-once usability snapshot
```

## Rules for a generating agent

1. **Isolation.** Report only *your own* firsthand experience. **Do not read other `dogfood/*` folders.**
   An independent view is the whole point — cross-reading biases the result and corrupts the recurrence
   signal the maintainer relies on.
2. **Write-once.** Your `EXPRESSIVENESS.md` is dated and immutable. Do **not** update, fix, or reconcile
   earlier dogfoods. Each run is a fresh folder. (The maintainer will not be retro-marking old snapshots
   as "fixed" — staleness is expected and fine.)
3. **Snapshot banner.** Begin `EXPRESSIVENESS.md` with, verbatim:
   `> ⚠️ Point-in-time DSL usability snapshot (YYYY-MM-DD). NOT spec truth — may be obsolete. Source of truth: dsl/ + packages/.`
4. **Standard sections** in `EXPRESSIVENESS.md`:
   - *What expressed cleanly*
   - *Gaps & limitations* — each labeled a `task` (bug/impl) or `RFC` (design) candidate
   - *Parser & linter error-message quality* — only errors you hit firsthand: the exact message + the
     clearer author-facing message that would have helped
   Ground every entry in real experience from your run. **No generic best-practices.**
5. Lint the `.behavior`/`.description` with `@dot-agent/compiler`; **never** `pack` or run them (no kernel here).
6. **Quarantine skill output.** Running the skill under test may write real files into the live tree (an
   example ADR in `adr/`, an example RFC in `rfcs/`, etc.). After capturing your findings, **move every
   generated artifact into `dogfood/<this-skill>/examples/`, mirroring its original path** — e.g. an
   example ADR → `dogfood/new-adr/examples/adr/<file>`; an example RFC → `dogfood/new-rfc/examples/rfcs/<file>`
   — or delete it. **Never leave skill output in the live `adr/` / `rfcs/` / `examples/` folders.** These
   `examples/` are throwaway proof and are git-ignored — do not commit them.

## Consolidation (maintainer only)

Periodically the maintainer reads across folders and turns findings into RFCs / tasks. A gap that recurs
across several *independent* dogfoods carries more weight — which is exactly why generating agents stay
isolated and never do the cross-folder step themselves.
