# DSL — Language & Architecture

Complete reference for the agent DSL ecosystem: design philosophy, syntax, type system, security model, and packaging strategy. For formal grammar rules, see [`grammar.agent.md`](grammar.agent.md) and [`grammar.flow.md`](grammar.flow.md).

---

## 1. The Ecosystem

### 1.1 Two Formats, One System

Every agent is defined by two files with a clear division of responsibility:

```
.agent  —  the manifest: what the agent is, consumes, and exposes
.flow   —  the behavior: how the agent executes, state by state
```

This mirrors the `.h` / `.c` split in C:

- **`.agent`** is the header file — the public contract. The Runtime reads it for capability enforcement, dependency resolution, and tool discovery. Other agents and registries index it without ever reading the behavior.
- **`.flow`** is the implementation — private to the agent. It contains state logic, prompt injection, and execution flow.

This separation is a runtime guarantee, not just a convention: in a distributed ecosystem, reading dozens of full `.flow` files to discover agents would be unworkable. The `.agent` manifest enables instant indexing. The `capabilities` block forces developers to declare permissions, which the Runtime then enforces against what the `.flow` actually executes.

```
Ecosystem
 ├── Agents       — declarative manifests: "What I am"
 ├── Behaviors    — .flow files: "How I work"
 ├── Types        — data contracts anchored to Wikidata/Schema.org
 ├── Capabilities — actions and sandbox permissions
 └── Runtime      — the "OS": resolves dependencies, runs LLMs, validates contracts
```

### 1.2 The Runtime as Operating System

The Runtime (whether Claude, Gemini, or a custom engine) acts as the operating system of the agent ecosystem. It reads manifests, resolves dependencies, and orchestrates execution.

**Example: orchestration via `requires`**

1. A system invokes the `Doctor` agent
2. The Runtime reads: `requires Prontuario`
3. It finds `Prontuario` is not in the current context
4. It locates which agent produces `output Prontuario`, invokes `Triage`, validates the returned JSON against the declared type structure, and passes it to `Doctor`

Determinism is central: the Runtime never invents data structures at runtime. Every piece of data that flows between agents needs an explicit contract.

### 1.3 `.flow` and `.run`: Same Purpose, Different Formats

`.flow` and `.run` both serve the same goal: **deterministic orchestration of agent state**. They differ in format and power scope.

```
Prompt  →  .flow  →  .run  →  Runtime
```

Each layer serves a purpose:

- **Prompt** — highly flexible, probabilistic. The LLM reasons, interprets, and generates. Poorly suited to enforcing routing logic or deterministic tool calls.
- **`.flow`** — structured, readable, deterministic. A text-based subset of what `.run` can do. Designed so agents can be authored without writing code or compiling to WASM.
- **`.run`** — compiled WASM. Full power. Handles everything `.flow` cannot: loops, complex aggregations, transactional rollback, IP-protected logic, strict regulatory compliance.
- **Runtime** — the execution layer. Interprets `.flow`, compiles it to `.run` as needed, manages memory, routes to models.

**The key insight:** everything expressible in `.flow` could be written in `.run`. `.flow` is not a different system — it is a simpler entry point into the same system. The Runtime compiles `.flow` to its internal execution format; `.run` allows authors to write that format directly when they need capabilities beyond `.flow`'s scope.

**When to use `.flow`:** the agent workflow is too structured for a prompt but not complex enough to justify writing WASM. This is the common case.

**When to use `.run`:** the workflow needs loops, complex data aggregation, transactional rollback, high-performance math, or logic that must remain opaque (IP protection).

The criterion for crossing from `.flow` to `.run` is **cognitive density**, not line count. A `.flow` file should remain scannable in under 30 seconds. When it cannot, that complexity belongs in `.run`.

Signals that a flow has crossed the frontier:
- You need to loop over a collection
- You need to aggregate and transform results before acting
- You need transactional rollback across multiple operations
- The flow requires arithmetic beyond simple comparisons

---

## 2. Design Principles

### 2.1 Shared Principles

Both `.agent` and `.flow` share the same core constraints:

1. **Zero noise.** No curly braces `{}`, no mandatory commas in blocks, no colons in key-value pairs. Files should read like a textual diagram, not code.
2. **Semantic indentation.** Scope is defined by 2-space indentation (like Python/YAML). The parser uses an external scanner to track indentation levels.
3. **Determinism.** Custom types must be declared explicitly with a semantic anchor (Wikidata). The LLM never infers the structure of a custom type dynamically.

### 2.2 `.flow` Design Principles

**Small vocabulary as a product decision.**

The reserved word count is a product metric, not just a syntactic choice. A smaller vocabulary means: faster to learn, easier to document, more predictable when generated by AI, less surface area for misuse.

Every proposed addition to the language must answer:

> "Does this reduce cognitive load, or does it only add power?"

Power alone is not justification. Power belongs in `.run`.

**What `.flow` is not:**

- **Not a simplified programming language.** No loops, no recursion, no arithmetic. These belong in scripts or `.run`.
- **Not YAML with fewer symbols.** YAML is a data format. `.flow` is a behavioral language. The distinction matters for readability and for how AI generates it.
- **Not natural language.** The temptation to drift toward prose (e.g., `remember that I prefer Portuguese`) must be resisted. Natural language reduces parseability and predictability. The language uses human concepts with structured syntax — not prose.
- **Not a competitor to LangGraph or XState.** Those frameworks are compilation targets. `.flow` abstracts over them.

### 2.3 Design Inspirations

Before converging on a custom verb-oriented DSL, several established approaches were studied:

1. **Statecharts (XState / SCXML)** — contributed the concept of parallel states: an agent maintains a primary action plan while simultaneously listening to global triggers via `on event`.
2. **Behavior Trees (Unreal Engine / ROS)** — contributed goal-oriented logic and failure resilience (`on failed` blocks). Execution proceeds imperatively; failure is handled locally without crashing the whole machine.
3. **Amazon States Language (AWS Step Functions)** — contributed strict input/output isolation for state nodes, reflected in how `run tool`, `run script`, and `run subagent` are atomic side-effect units.
4. **GitHub Actions** — contributed sequential, step-by-step syntax. Inspired the readable, top-down block structure of `.flow` states.

**Why not YAML or JSON?** The first draft used strict YAML. It was abandoned because YAML introduces syntactic noise (hyphens, deep indentation, mandatory quoting) that harms readability for non-programmers and encourages formatting hallucinations in smaller models.

---

## 3. The Manifest (`.agent`)

### 3.1 Base Structure

The `agent` keyword defines the root node. Identity metadata (`domain`, `license`, `terms`, `privacy`) is indented under it. Semantic blocks (`description`, `behavior`, `requires`, etc.) are top-level in the file — implicitly associated with the preceding `agent` declaration.

```
agent Analyst
  domain figma.com
  license MIT
  terms  https://figma.com/terms
  privacy https://figma.com/privacy

description
  A financial agent that analyzes expenses and generates reports

behavior analyst.flow

requires BankStatement

input
  Person "The user requesting financial analysis"

capabilities
  CalculateAction "Enables mathematical calculations"
  SearchAction    "Queries external financial rates"

output
  FinancialProduct "The recommended product for the user"
```

**Semantic block keywords:**

| Keyword | Function |
|---|---|
| `description` | Free-text description. Used by the Runtime for semantic indexing. |
| `behavior` | The `.flow` file that manages state and transitions. Always inline: `behavior agent.flow`. |
| `requires` | Types the Runtime must guarantee in context before invoking the `.flow`. |
| `input` | Input data types the agent needs to operate. |
| `capabilities` | Actions (Schema.org `Action`) or resources the agent may use. Also the sandboxing contract. |
| `output` | The data type returned by the agent. |

### 3.2 Custom Types

Whenever an agent uses data that doesn't exist in Schema.org, the type must be declared with `type`. The declaration is a **hard contract** for the Runtime — the LLM never attempts to infer the structure of a custom type.

```
type BankStatement
  concept https://www.wikidata.org/wiki/Q806653
  account: Person      "Account holder"
  transactions: [Transaction]
  balance: Number
  status: Enum(active, closed, suspended)
  avatar?: ImageObject "Holder photo (optional)"
```

**Keywords inside `type`:**

| Keyword | Function |
|---|---|
| `concept` | Wikidata or Schema.org URL anchoring semantic meaning globally. Prevents ambiguity across agents from different vendors. |
| `schema` | (Optional) Strict JSON Schema file for validation: `schema bankstatement.json` |

**Property value forms:**

| Form | Example | Semantics |
|---|---|---|
| Simple reference | `account: Person` | Single type |
| Array | `transactions: [Transaction]` | Typed list |
| Enum | `status: Enum(active, closed)` | Closed set of literals |
| Optional | `avatar?: ImageObject` | `?` marks the field as optional |
| With description | `account: Person "Holder"` | Quoted string documents the property |

### 3.3 Naming Conventions and Comments

**Naming conventions:**

| Element | Convention | Examples |
|---|---|---|
| Agent name | Space-separated words, each capitalized | `agent Doctor`, `agent Mickey Mouse` |
| Custom type | Continuous PascalCase | `UserProfile`, `BankStatement`, `MedicalCondition` |
| Stdlib namespace | `std.` + PascalCase | `std.Prompt`, `std.ImageObject` |
| Custom namespace | `custom.` + PascalCase | `custom.SpeechSynthesis` |
| Type property | camelCase | `patient`, `createdAt`, `transactionList` |

The parser distinguishes agent names from types by structural context: after `agent`, it always expects an `agent_name` (space-separated words); after `input`, `output`, etc., it always expects type references (PascalCase).

**Comments:** any line (or fragment) starting with `//` is ignored by the parser. Comments may appear inline or on their own lines, including inside blocks.

```
// This agent is in draft
agent Draft
  domain example.com
```

### 3.4 Compact vs. Documented Syntax

The `requires`, `input`, `capabilities`, and `output` blocks support two forms:

**Compact** (inline, no descriptions):
```
input Patient, MedicalCondition
capabilities DiagnoseAction, CreateAction
requires Prontuario, UserProfile
```

**Documented** (indented block, optional descriptions):
```
input
  Patient "The patient to attend"
  MedicalCondition

capabilities
  DiagnoseAction         "Emits clinical diagnoses"
  custom.SpeechSynthesis "Voice synthesis"

requires
  Prontuario ("Electronic health record")
  UserProfile
```

The difference between annotation and description:
- **Parenthesized annotation** `Type ("text")` — in `type_reference`, documents what that type means in this specific context
- **Quoted description** `Type "text"` — in `typed_item`/`cap_item` (input/output/capabilities blocks), documents the purpose of the item

### 3.5 Security and Capabilities

The `capabilities` block is not merely descriptive — it is a **sandboxing contract**. The Runtime uses this list to determine which permissions the agent holds.

If an agent declares `SelfEvolution` or `AgentCreation`, the Runtime intercepts these requests and may require explicit human authorization (Human-in-the-Loop) before modifying packages in `.agents/*`.

**High-risk capabilities:**

| Capability | Effect |
|---|---|
| `AgentCreation` | Can create sub-agents |
| `SelfEvolution` | Can modify its own behavior files |
| `AgentUpgrade` | Can request runtime version updates |

**Identity and Anti-Spoofing (the `domain` block):**

Declaring `domain figma.com` turns the local manifest into a pointer to the official authority:

1. **W3C validation:** The Runtime verifies identity using W3C DIDs or `.well-known` directories
2. **Synchronization:** The Runtime may fetch the canonical definition from `https://figma.com/.well-known/agents/Figma.agent` and override the local manifest
3. **Spoof prevention:** If an attacker creates an agent with `domain figma.com`, the Runtime fetches from the real server. If the server doesn't list that agent, the local package is invalidated.

Informal community agents may omit `domain` — the Runtime treats them as "Unverified".

---

## 4. The Behavior (`.flow`)

### 4.1 Runtime vs. User Scope

`.flow` divides responsibility between what the engine enforces and what the agent developer declares.

**Closed scope (managed by the Runtime, not writable by the user):**
- `compaction_threshold` — local context window management
- `permissions` — access control to filesystem, network, MCP servers
- Built-in variables: `session.is_first_time`, `session.prompt_count`
- Native states: `online`, `offline`, `ended`

**Declarative scope (written in `.flow`):**
- Overriding `init`, `onboarding`, and the default `responsive` state
- Creating arbitrary business states (e.g., `phases.planning`)
- Deterministic orchestration: tools, subagents, scripts, conditional evaluation

### 4.2 Memory Domains

`.flow` tracks state across four semantic scopes:

| Domain | Lifetime | Use |
|---|---|---|
| `context` | Current LLM turn | Active working memory for the model |
| `session` | Current conversation thread | Cross-turn conversation state |
| `worksession` | Current work unit | Task-scoped data |
| `user` | Long-term, persistent | User preferences and history |

```flow
set context.active_phase   = "planning"   // cleared after this turn
set session.has_context    = true         // cleared when thread closes
set worksession.phase      = "review"     // cleared when work unit ends
set user.language          = "pt-br"      // persists across all conversations
```

> **Note:** `grammar.flow.md` currently lists `project` as a domain name instead of `worksession`. This discrepancy is tracked as an open question and will be resolved when tree-sitter grammars are updated in Stage 4.

### 4.3 Flow Composition via `merge`

`.flow` files can include states from other `.flow` files using `merge`:

```flow
// preamble — before any state declaration
merge "phases/planning.flow"
merge "phases/review.flow"

state responsive
  interact
  on intent "planning" next phases.planning.start
  on intent "review"   next phases.review.start
  on escape            next responsive
```

`merge` is **preamble-only**: it must appear at the top of the file, before any `state` declaration. It is resolved at compile time (eager). All states from the merged file enter the **same flat namespace** as if they had been written inline — there is no state hierarchy at runtime.

Dynamic/lazy loading is out of scope for `.flow`. Scenarios requiring conditional or runtime-deferred flow loading belong in `.run`, which has the memory management primitives to handle unload safely.

### 4.4 Design Philosophy

**Flat states only — no hierarchical nesting.**
Nested states create scope ambiguity around which state handles a given event. `.flow` machines are flat. When a workflow grows too complex, the correct pattern is composition via `merge` (for related states) or decomposition into `.run` (for logic that exceeds `.flow`'s cognitive scope).

**Procedural guards — not declarative.**
XState evaluates guards *before* entering a state. `.flow` evaluates conditions *inside* the state after entry. This matches both the natural reading order of humans and the generative direction of LLMs. `if / else` inside a state is always clearer than an entry predicate attached to a transition.

**Entry actions only — no exit actions.**
The underlying LLM is stateless across turns. Exit actions introduce lifecycle complexity that cannot be guaranteed. `.flow` focuses strictly on what happens when a state is entered.

**Global observers replace orthogonal states.**
True orthogonality — being in multiple states simultaneously — creates concurrency paradoxes. `.flow` uses `on event` at the top level to monitor background signals while the main machine remains linear.

### 4.5 IDE Tooling

Any IDE or tooling implementing `.flow` support **must** resolve file paths in string literals that follow standard actions (e.g., `merge`, `run script`, `guide`, `teach`). These should be rendered as clickable document links (underline on hover), allowing the developer to navigate directly to the referenced file relative to the workspace root.

---

## 5. Type System and Namespaces

Types without a namespace are resolved by the Runtime in the following precedence order:

1. **Custom** — `type` declarations in the agent's own package (absolute precedence)
2. **Standard Library** — `std.*` (pre-defined types in the Spec)
3. **Global** — Schema.org / Wikidata

The local scope has **absolute shadowing**: if a `type Prompt` exists locally, it takes priority over `std.Prompt` automatically, preventing third-party updates from breaking the agent.

*Example:* The type `Prompt` is referenced. If a local `type Prompt` exists → uses local. Otherwise, the Runtime resolves `std.Prompt`.

---

## 6. Three-Layer Packaging

To keep the human-authored manifest free of systemic noise (versions, changelogs, marketplace categories), the ecosystem uses a three-layer architecture:

### Layer 1: Human DX (Authoring)

What the human developer writes and maintains:

- **Contains:** `.agent`, `.flow`, `AGENTS.md` (persona and reasoning guidelines)
- **Does not contain:** version tags (`v1.0.2`), changelogs, file lists, marketplace categories
- **Exception:** `domain`, `license`, `terms`, `privacy` live here because they are fundamental identity and compliance metadata

### Layer 2: Tooling & AI Generated (The Envelope)

Generated by build CLIs or by the Runtime at publish time:

- **Versioning:** Derived from git history (e.g., `urn:agent:com.figma:v2:a1b2c3d4`). The human never writes `version`.
- **Categorization:** Inferred by an ingestion LLM from `input`/`output` types. An agent that consumes `BankStatement` and produces `FinancialReport` is automatically classified as `FinanceApplication`.
- **File integrity:** The packager audits `/data` and `/scripts` and generates a `checksum.lock` invisible to the author.

### Layer 3: Machine (Execution & Registry)

The optimized representation the Runtime OS reads:

- **Contains:** transpiled JSON-LD, WASM binaries (if `.run` is present), and the `.agent` merged with the Layer 2 envelope for MCP-based discovery

### Resolved design decisions

| Question | Decision |
|---|---|
| Where does Persona/Prompt live? | Isolated `.md` files. `.flow` injects via `guide "AGENTS.md"`. The `.agent` is not involved. |
| How are Actions mapped to files? | The `.agent` declares the Action. The `.flow` listens and triggers the script. |
| Where does versioning live? | Layer 2 (inferred from git). Absent from Layer 1. |
| How are HTTP/MCP interfaces declared? | Open question — see §7. |

---

## 7. Open Questions

Areas identified for future specification work:

**Memory domain naming:** `grammar.flow.md` lists `project` as a memory domain; other docs and examples use `worksession`. The canonical name must be aligned and the grammar updated before tree-sitter grammars are finalized (Stage 4).

**HTTP/MCP interface declaration:** If an agent is an MCP wrapper (like `figma.agent`), there is no formal syntax yet to declare that it exposes HTTP endpoints. Candidates under evaluation:
- Keyword `server` in the DSL (Layer 1)
- Attribute in Layer 2, inferred by static analysis of `capabilities`
- Explicit registration in the domain's `.well-known`

**Dynamic parallelism (batch execution):** The current `parallel` block requires a statically known list of tasks. A batch modifier for iterating over a collection is tentatively called `each`:

```flow
run subagent "reviewer" each context.files
on complete
  set worksession.reviews = results
  next review_summary
on failed
  next handle_review_error
```

**Human-in-the-loop gate:** `interact` pauses the machine for conversational input. Some workflows need a stricter authorization gate — separate from conversation — before executing a dangerous tool.

**Checkpointing:** Whether checkpointing is implicit at every `next` transition or requires an explicit directive for long-running flows.

**Timeouts:** `.flow` currently has no temporal boundary on tool or subagent execution. A stalled call hangs the machine indefinitely.

**Subagent return contract:** The convention for accessing subagent output is currently implicit and unspecified, creating ambiguity for compiler authors.

**`.logic` in org-spec:** References to `.logic` (deprecated term for `.run`) still appear in `org-spec/` documents. These need to be updated in a separate pass against that submodule.
