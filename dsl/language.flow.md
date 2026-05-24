# `.flow` Language Design

This document covers the architectural decisions, design philosophy, and future directions of the `.flow` language. It complements the grammar reference and is primarily aimed at runtime implementors and language contributors.

---

## 1. Design Inspirations

Before converging on a custom verb-oriented DSL, several established approaches were studied:

1. **Statecharts (XState / SCXML)**
   - *Contribution:* The concept of parallel states — an agent maintains a primary action plan while simultaneously listening to global triggers via `on event`.

2. **Behavior Trees (Unreal Engine / ROS)**
   - *Contribution:* Goal-oriented logic and failure resilience (`on failed` blocks). Execution proceeds imperatively; failure is handled locally without crashing the whole machine.

3. **Amazon States Language — ASL (AWS Step Functions)**
   - *Contribution:* Strict input/output isolation for state nodes. Reflected in how `run tool`, `run script`, and `run subagent` are atomic side-effect units.

4. **GitHub Actions**
   - *Contribution:* Sequential, step-by-step syntax. Inspired the readable, top-down block structure of `.flow` states.

### Why not YAML or JSON?

The first draft of the spec used strict YAML. It was abandoned because YAML introduces syntactic noise (hyphens, deep indentation, mandatory quoting) that harms readability for non-programmers and encourages formatting hallucinations in smaller models. A punctuation-free DSL — closer to Swift or HCL — ensures clarity at every skill level.

---

## 2. Runtime vs. User Flow

The `.flow` architecture divides responsibility between what the Engine enforces and what the agent developer declares.

### Closed Scope (Managed by the Runtime)

Not writable by the user:

- `compaction_threshold` — local context window management.
- `permissions` — access control to filesystem, network, MCP servers.
- Built-in variables: `session.is_first_time`, `session.prompt_count`.
- Native states: `online`, `offline`, `ended`.

### Declarative Scope (Written in `.flow`)

- Overriding `init`, `onboarding`, and the default `responsive` state.
- Creating arbitrary business states (e.g., `phases.planning`).
- Deterministic orchestration: tools, subagents, scripts, conditional evaluation.

The `.flow` file is the universal source of truth. The runtime compiles it to whatever execution target is needed (LangGraph, XState JSON, etc.) without requiring changes to the `.flow` source.

---

## 3. Design Philosophy (vs. SCXML / XState)

`.flow` intentionally omits certain constructs common in mature state machine frameworks. These are deliberate choices to keep the language readable by non-programmers and predictable for LLMs.

**Flat states only — no hierarchical nesting.**
Nested states create scope ambiguity around which state handles a given event. `.flow` machines are flat. When a workflow grows too complex, the correct pattern is composition: `merge "other.flow"` (preamble, eager) or decomposition into `.run` (the compiled execution layer).

### Flow Composition via `merge`

`.flow` files can include states from other `.flow` files using `merge`:

```flow
merge "phases/planning.flow"
merge "phases/review.flow"
```

`merge` is preamble-only: it must appear at the top of the file, before any `state` declaration. It is resolved at compile time (eager). All states from the merged file enter the same flat namespace as if they had been written inline.

**Dynamic/lazy loading is out of scope for `.flow`.** Scenarios requiring conditional or runtime-deferred flow loading belong in `.run` (the WASM execution layer), which has the memory management primitives to handle unload safely.

**Procedural guards — not declarative.**
XState evaluates guards *before* entering a state. `.flow` evaluates conditions *inside* the state after entry. This matches both the natural reading order of humans and the generative direction of LLMs. `if / else` inside a state is always clearer than an entry predicate attached to a transition.

**Entry actions only — no exit actions.**
The underlying LLM is stateless across turns. Exit actions introduce lifecycle complexity that cannot be guaranteed. `.flow` focuses strictly on what happens when a state is entered.

**Global observers replace orthogonal states.**
True orthogonality — being in multiple states simultaneously — creates concurrency paradoxes. `.flow` uses `on event` at the top level to monitor background signals while the main machine remains linear.

---

## 4. IDE UX and Tooling Requirements

While the `.flow` grammar only specifies how the text is parsed, tooling (like Language Servers and IDE Extensions) should provide a robust developer experience.

### Document Links

Any IDE or tooling implementing support for `.flow` MUST resolve file paths in string literals that follow standard actions (e.g., `merge`, `run script`, `guide`, `teach`). These should be rendered as clickable document links (with underline on hover), allowing the developer to navigate directly to the referenced script or flow file relative to the workspace root.

---

## 5. Opportunities and Open Questions

Areas identified for future specification work:

### 5.1. Dynamic Parallelism (batch execution)

The current `parallel` block requires a statically known list of tasks. Frameworks like LangGraph support dynamic fan-out based on runtime state (the `Send` API).

**Direction:** A batch modifier for iterating over a collection — tentatively `each`:

```flow
run subagent "reviewer" each context.files
on complete
  set worksession.reviews = results
  next review_summary
on failed
  next handle_review_error
```

Keyword (`each` vs. `for each` vs. another form) is still open.

### 4.2. Human-in-the-Loop Gate

`interact` pauses the machine for conversational input. Some workflows need a stricter authorization gate — a cryptographic or explicit click approval before executing a dangerous tool — separate from conversational flow.

**Direction:** An `interrupt` or `gate` keyword that halts execution until human authorization is confirmed, distinct from `interact`.

### 4.3. Checkpointing

State machine frameworks excel at persisting checkpoints so workflows can resume safely after a crash (e.g., LangGraph's `thread_ts`).

**Direction:** Define whether checkpointing is implicit at every `next` transition or requires an explicit `checkpoint` directive for long-running flows.

### 4.4. Timeouts

`.flow` currently has no temporal boundaries on executions. A stalled tool or subagent hangs the machine indefinitely.

**Direction:** A timeout modifier on any `run` statement:

```flow
run tool "Scrape.Page" url timeout 30s
on failed
  next handle_timeout
```

### 4.5. Subagent Return Contract

The current convention for accessing subagent output (`session.agentname.field`) is implicit and unspecified. This creates ambiguity for compiler authors and runtime implementors.

**Direction:** Define a formal return contract — either a typed output binding or a reserved identifier — so that subagent results are unambiguous in `.flow` source.
