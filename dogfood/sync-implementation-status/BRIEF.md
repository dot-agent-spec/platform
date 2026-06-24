# Brief — Author the `/sync-implementation-status` skill (+ optional DSL dogfood)

> **For the operator:** open a Claude Code session on the `dot-agent-spec` repo and point it at this
> brief. This skill is **analysis-heavy** (it reads code across layers) — run it on **Sonnet** (or Opus
> for the first authoring pass); see the model-routing note. Sibling of `/new-rfc`.

## Context

`docs/explanation/architecture/implementation-status.md` is a caniuse-style tracker: **rows = DSL
features, columns = packages in layer order**. It drifts the moment any package changes. This skill
**re-derives the table from the actual code**, not from the existing doc — both `implementation-status.md`
and `tasks/AGENTS.md` warn that the doc describes *intent*, not *outcome*. Treat the current doc as a
prior to verify and update, never as truth.

**Source of truth:** the tree-sitter grammar. A feature exists because it has a grammar node; each
downstream layer then either implements it, partially implements it, or drops it.

## Read first (ground truth)

- **The doc to maintain:** `docs/explanation/architecture/implementation-status.md` — study its legend
  (☑️✅ · ⚠️ · ❌ · → · 🔄 · 🗑️ · ➕ · 📌), its column order (tree-sitter → parser-dsl → compiler →
  kernel-dsl → sdk), and its "Node name discrepancy" section (grammar node names ≠ parser serde names,
  e.g. `intent_handler` ↔ `intent_trigger`).
- **Layer source code (submodules — `git submodule update --init` first; skip a layer if it stays empty):**
  - `packages/tree-sitter` — grammar node types (`grammar.js` / `node-types.json` / `NODE_TYPES_BEHAVIOR`) = the canonical feature list
  - `packages/parser-dsl` — Rust AST variants (`ast` module): does each grammar node have an AST type?
  - `packages/compiler` — lint rules / handling per feature (`src/`)
  - `packages/kernel-dsl` — which features emit an `Effect`
  - `packages/sdk` — which effects have handlers / wrappers
- Convention: `rfcs/AGENTS.md` (legend style), `GOVERNANCE.md`.

## Deliverable 1 — the skill `/sync-implementation-status`

A `SKILL.md` (+ helper scripts as needed) that:

1. Initializes/refreshes the package submodules.
2. Extracts the **feature list** from the tree-sitter grammar node types (the canonical rows).
3. For each feature, **verifies presence in each downstream layer** by reading that package's source
   (not the doc): parser AST variant → compiler lint/handling → kernel effect → sdk handler.
4. Detects drift classes and marks them with the right symbol:
   - grammar node with no downstream → `❌` (should exist) where appropriate
   - AST/effect with **no matching grammar node** → `🗑️` (dead node)
   - hardcoded value that should derive from the language → `📌`
   - field injected at a layer with no upstream DSL source → `➕`
   - parsed-but-dropped / partial → `⚠️`
5. Regenerates the tables **preserving the doc's exact structure, legend, and the node-name-discrepancy
   mapping**, and updates the per-package freeze/version header.
6. Emits a **drift report**: a concise diff of what changed vs the previous doc (new gaps, resolved
   gaps, newly dead nodes) — this is the part the human actually reads.

Make verification steps explicit and checklist-driven so the result is reproducible across runs and
models. Where a check is ambiguous, the skill should flag `?` rather than guess.

## Deliverable 2 — DSL dogfood (optional, secondary)

Only if time allows. Try to model a "status sync" flow as `.behavior`/`.description` under `dogfood/`.
This one will **stress the DSL hard** (it is code analysis, not conversation) — that is the point: where
it cannot express the flow cleanly, record it in `dogfood/EXPRESSIVENESS.md` as an RFC candidate. Lint
only; do not run or pack. If the DSL clearly is not meant for this shape, say so plainly in the report —
a documented "out of scope" is also useful spec feedback.

## Constraints

- Re-derive from code; never copy the old doc forward unverified.
- Preserve the doc's exact format — this is a *regeneration*, not a redesign. If a structural change is
  warranted, propose it separately, do not silently apply it.
- Respect the submodule boundary: the doc lives in the superproject; the evidence lives in submodules.

## Definition of done

- Running the skill on the current repo reproduces `implementation-status.md` (or a justified update),
  with every cell backed by a code reference, plus a drift report.
- A re-run is stable (no spurious changes).
- (If attempted) dogfood lints clean or its limits are documented in `EXPRESSIVENESS.md`.

## Model-routing note

This skill is analysis-heavy. Recommended shape:

- **Verification/derivation step** (reading code across layers, judging partial vs full) → strongest
  tier (`model: opus` or `sonnet`, `effort: high`). Set via the skill's `model:`/`effort:` frontmatter,
  or delegate this step to a subagent with its own `model:`.
- **Table/report formatting** → cheap tier (`model: haiku`, `effort: low`).

`SKILL.md` frontmatter supports `model`, `effort`, `context: fork`, and `agent` (ref:
https://code.claude.com/docs/en/skills). Keep the analysis and the formatting as separate seams so each
can be routed independently.
