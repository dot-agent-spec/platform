> ⚠️ Point-in-time DSL usability snapshot (2026-06-23). NOT spec truth — may be obsolete. Source of truth: dsl/ + packages/.

# Expressiveness Report — `adr-author` dogfood

**Skill modeled:** `/new-adr`
**DSL files:** `adr-author.behavior`, `adr-author.description`
**Run date:** 2026-06-23
**Model:** claude-sonnet-4-6

---

## What expressed cleanly

- **Linear oriented-state pipeline.** The `collect_decision → check_supersession → draft_sections → emit → done` chain maps directly to `state` blocks with `transition to`. No awkward coercion required; the state machine reads like a description of the workflow.

- **Dual-intent optional input.** Splitting the supersession question into two intents — `"supersedes confirmed"` and `"no supersession"` — neatly handles an optional decision point. The `guide` carries the burden of telling the model to wait for an explicit answer; the DSL routes cleanly from there.

- **Boolean session flag across states.** `set session.supersedes = true/false` inside `on intent` block handlers propagates the supersession choice across the state boundary cleanly. The `emit` script can read this flag to decide whether to run the old-ADR update. No workarounds needed here — the session write/read contract worked as expected.

- **Error handling.** `run script "..." on failure → transition to error` at each script-running state, with a dedicated `error` state offering retry, felt sufficient and natural to write. No surprises.

- **Forward state references.** `draft_sections` transitions to `emit`, which is declared later in the file. The linter did not complain about forward references, which is correct — state machines shouldn't require declaration order.

---

## Gaps & limitations

### 1. No conditional script execution — `RFC` candidate

The supersession update (editing the old ADR's two header fields) should ideally run *only if* `session.supersedes == true`. The DSL has `if session.x == true … end`, and the `run script` statement appears in setup states. But combining `run script … on failure` inside an `if` body is untested and potentially ambiguous — the `on failure` block is itself a nested control-flow construct, and the reference explicitly warns against nesting. I could not confidently write:

```
if session.supersedes == true
  run script "scripts/update-superseded.js" on failure
    transition to error
end
```

Without knowing whether the parser accepted this. I worked around it by collapsing both actions into `emit-adr.js` and letting the script read the session flag internally. This leaks branching logic out of the DSL and into the script.

**RFC candidate:** a `run script X if session.var == value` shorthand, or a formal guarantee that `run … on failure` is valid inside `if/else` bodies.

### 2. No script-output binding to session variables — `RFC` candidate

The `/new-adr` workflow requires three values computed at runtime: the next ADR number (from a `find | grep | sort | tail` command), today's date (from `date +%Y-%m-%d`), and the decision slug. In the behavior, these computations happen inside `scripts/scaffold-adr.js`, but the DSL has no way to bind their output to session variables:

```
// desired but not expressible:
set session.adr_number = run script "scripts/get-next-number.sh"
```

Every piece of state that a later state needs must either be written to a file by the script or passed implicitly through conversation context. For a small model, this implicit relay is fragile.

**RFC candidate:** script output binding — `set session.x = run script "..."`.

### 3. Oriented `done` state cannot branch on session variable — `task` candidate

The `done` state's guide says "if this ADR superseded another, mention that the old ADR's fields were updated." But `done` is an oriented state — it can't branch on `session.supersedes` to provide different guide text for the two cases. The model is expected to infer from conversation context whether supersession happened. For a small model this may produce inconsistent confirmation messages.

A cleaner pattern would be two terminal states (`done_plain` and `done_superseded`) with a setup state routing between them via `if/else`. But this creates boilerplate for a pattern that arises frequently: "say slightly different things at the end based on what happened."

**task candidate:** document the two-terminal-state pattern as the canonical workaround for session-conditional final messages.

### 4. No explicit entry-point declaration — `task` candidate

The first `state` block in the file (`collect_decision`) becomes the entry point by implicit convention. The spec doesn't state this rule explicitly; I inferred it from the order of `state` declarations and from looking at the rfc-author behavior. A new author reading only the reference would not know this.

**task candidate:** add an "entry point" note to `dsl/reference/behavior.md` — whether it is the first `state` declared, a reserved name like `init`, or something else.

### 5. No way to model the "effort seam" for judgment-heavy sub-steps — `RFC` candidate

The `/new-adr` skill's **Options considered** section is the judgment-intensive step — it benefits from a stronger model or higher effort. In the SKILL.md I documented this as a prose "effort seam" note. In the behavior, I have no way to express it: `draft_sections` just calls `scripts/scaffold-adr.js` as a black box. There is no `run subagent "..." at effort "high"` or equivalent.

The reference shows `run subagent "reviewer.behavior" "context params"` but doesn't show a way to pass an effort or model tier to a dynamically-selected subagent. Expressing "delegate this sub-step at higher quality" requires either a separate `.behavior` file for the heavy step (overkill) or leaving it implicit in the script.

**RFC candidate:** effort/model annotation on `run subagent` — `run subagent "options-drafter.behavior" effort "high"`.

---

## Small-model run result

I ran through all skill steps manually (Sonnet 4.6) acting as the executing model:

- **Basic run** (`/new-adr markdown-only format for skill definitions`) produced ADR-0003 with the correct license block, heading format, metadata table, five required sections, no HTML comments, and `Status: Accepted`. The bash commands in Steps 2 and 3 are deterministic and leave no guesswork.

- **Supersession run** (`/new-adr skill checklist as required convention`, supersedes ADR-0003) produced ADR-0004 with `Supersedes: ADR-0003` in its header, and updated ADR-0003's `Status` to `Superseded` and added `Superseded by: ADR-0004` — body of ADR-0003 unchanged.

- **Small-model assessment:** The checklist-driven structure, explicit bash commands, and `templates/adr.md` as the single source of truth make the skill robust for small models. The one fragility is the Options considered section, which requires genuine judgment about alternatives — exactly the seam noted in the SKILL.md.

---

## Parser & linter error-message quality

I ran `lintBehavior` and `lintDescription` from `@dot-agent/compiler` on first-attempt versions of both files. Both returned `{}` — no errors.

No firsthand parser or linter errors to report.

One positive observation: the linter correctly accepted a forward `transition to emit` from `draft_sections` (where `emit` is declared later in the file). This is the right behavior for a state machine.
