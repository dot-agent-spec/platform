# Brief — Author the `/new-rfc` skill (+ DSL dogfood)

> **For the operator:** open a Claude Code session on the `dot-agent-spec` repo, model **Sonnet**,
> and point it at this brief ("read /tmp/dot-agent-skill-brief-rfc.md and execute"). Two deliverables.
> This is the first of a family (`/new-adr`, `/sync-implementation-status` come later) — design for reuse.

## Context

We are building reusable skills that lower the cost of producing the project's design docs. First
target: **creating an RFC**. The conventions already exist — your job is to *encode* them into a skill,
not invent them. Read the references before writing.

A **second, separate goal** is a dogfood test of the dot-agent DSL: express the same "create an RFC"
workflow as a `.behavior`/`.description` to see whether the language can model it. This is a *modeling*
exercise — it will **not** be executed (there is no kernel runtime in the editor yet). Lint it; do not
pack or run it.

## Read first (ground truth — do not skip)

- **Process:** `GOVERNANCE.md`, `rfcs/AGENTS.md`
- **RFC shape:** `templates/rfc.md`, `rfcs/INDEX.md` (impact-table format + legend), and 1–2 existing
  `rfcs/00NN-*.md` as exemplars
- **DSL reference:** `dsl/reference/behavior.md`, `dsl/reference/description.md`,
  `dsl/reference/types.md`, `dsl/reference/memory.md`
- **DSL philosophy & limits:** `dsl/explanation/design-principles.md`, `antipatterns.md`, `scope.md`,
  `behavior-vs-wasm.md`
- **DSL examples:** `examples/*.agent`
- **Linter:** `@dot-agent/compiler` — `full.lintBehavior(text)` / `full.lintDescription(text)`
  (package at `packages/compiler`; init the submodule if empty)

## Deliverable 1 — the Claude Code skill `/new-rfc`

A `SKILL.md` (+ any helper script) that, given a topic, produces a ready RFC from `templates/rfc.md`:

- pick the next RFC number; create the kebab-case file in `rfcs/`
- fill the metadata table and the **package-impact table** (infer/prompt for the 5-package symbols per
  the legend in `rfcs/AGENTS.md`)
- scaffold the standard sections from the template
- remind (or do) the `rfcs/INDEX.md` row addition

Design it **model-agnostic and highly structured** — explicit numbered steps + a checklist — so that
even a small model can execute it reliably. **Do not hardcode a model inside the skill** (see the
model-routing note at the bottom).

## Deliverable 2 — DSL dogfood (modeling only)

Author `rfc-author.description` + `rfc-author.behavior` expressing the same flow as a state machine
(e.g. states: collect topic → draft sections → validate impact table → emit). Keep these under a
scratch `dogfood/` dir so they are not mistaken for shipping code.

- Validate with the compiler linter; iterate until lint-clean.
- Do **not** depend on the kernel; do **not** pack to `.agent`.
- Produce `dogfood/EXPRESSIVENESS.md`: a short report — what the DSL expressed cleanly, and every place
  you had to bend the language or could not express the intent. **Each gap is a candidate RFC** — label
  it as such.

## Constraints

- Match existing conventions exactly: section headers, the Apache license comment block, tone.
- One source of truth — reuse `templates/rfc.md`; do not duplicate its structure into the skill.

## Definition of done

- `/new-rfc <sample topic>` produces a correct RFC scaffold.
- A **small-model run** of the same skill still yields a valid scaffold (this is the real test of
  whether the structure is good — report the result).
- `dogfood/rfc-author.{behavior,description}` lint clean; `dogfood/EXPRESSIVENESS.md` written with any
  gaps flagged as RFC candidates.

## Model-routing note (for the skill author)

A `SKILL.md` **can** set a `model:` frontmatter field — the override applies for the rest of the
current turn (not saved; the session model resumes on the next prompt). It also supports `effort`
(`low`…`max`) and `context: fork` + `agent:` to run the skill in a forked subagent. So two levers exist
for tiering:

1. **Coarse (turn-level):** set `model:` / `effort:` in the skill's own frontmatter (e.g. a boilerplate
   skill runs `model: haiku`, `effort: low`).
2. **Fine (per-step, mid-workflow):** delegate individual steps to subagents, which carry their own
   `model:`; the Task tool also accepts a per-call model override.

For `/new-rfc`: keep it model-agnostic by default (or `model: inherit`), and structure the
judgment-heavy step (drafting the impact table) as a clean seam that can be routed to a stronger model,
while the template-filling step can drop to haiku/low effort. Leave the routing as an obvious seam even
if v1 keeps everything on the session model.

Ref: https://code.claude.com/docs/en/skills (frontmatter reference).
