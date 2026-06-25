# Roadmap

This roadmap is organized by **language capability**, not by release date. It states precisely what the current milestone delivers, names the next capability tier, and keeps everything beyond that as a priority-ordered backlog with an explicit maturity status.

The single stability commitment is **v1.0** — the point at which the grammar is frozen as a public contract. Until then the DSL is `0.x`: usable, but the syntax may still change. We would rather ship a small honest surface than a large one that silently drops features.

> **Source of truth.** Feature status here is reconciled against [`docs/explanation/architecture/implementation-status.md`](docs/explanation/architecture/implementation-status.md) (what the packages actually do) and the design proposals in [`rfcs/`](rfcs/) (what is still being designed). When the two disagree, the implementation status wins.

---

## Two version axes

> Decision record: [DA00-02](project/adr/DA00-02-two-axis-versioning.md).

The project tracks **two independent versions** — do not conflate them.

| Axis | What it means | Cited by |
|---|---|---|
| **DSL version** | The public language capability tier (`v0.1`, `v0.2`, … `v1.0`). | Docs, users, agent authors |
| **Package versions** | Per-package npm/crate semver, evolving independently. | Dependency resolution |

**Mapping rule:** at each public release the package **tens digit mirrors the DSL milestone** — `0.10.x` packages = DSL `v0.1`, `0.20.x` = DSL `v0.2`, … reaching `1.0` together. Within a tens band each package keeps its own minor/patch freedom. (This resolves the current divergence — `tree-sitter` 0.4.1, `kernel-dsl` 0.1.3, the rest 0.1.0 — by jumping all of them to `0.10.x` at the first public publish.)

---

## Maturity legend

| Status | Meaning |
|---|---|
| ✅ **Stable** | Implemented end-to-end and part of the committed milestone |
| 🛠️ **In progress** | Targeted for the current milestone; not yet complete end-to-end |
| 📋 **Planned** | Designed (or designable from an existing RFC), scheduled but not started |
| 🔬 **Exploring** | Open design questions remain; an RFC exists but is not ratified |

Items that require **opening the grammar** (a change to `@dot-agent/tree-sitter`, which propagates down to every layer) are flagged 🔴. While the DSL is `0.x` the grammar is *preview* and may open; the goal is to open it as few times as possible and freeze it once at v1.0.

---

## v0.1 — Conversational `[current milestone]`

A pure conversational finite-state machine. No side effects, no typed I/O, no access control — an agent that holds a structured dialogue and routes between states. This is the surface the reference runtime exposes as the public proof-of-concept for `.agent`.

### `.behavior`

| Feature | Status |
|---|---|
| `state` | ✅ Stable |
| `goal` | ✅ Stable |
| `guide` | ✅ Stable |
| `teach` | ✅ Stable |
| `interact` | ✅ Stable |
| `on intent "…"` | ✅ Stable |
| `on offtopic` | ✅ Stable |
| `transition to` | ✅ Stable |
| `merge` (multi-file behavior) | 🛠️ In progress — parsed and lint-resolved, but the kernel does not yet resolve merged files at runtime |

### `.description` (minimal subset)

| Feature | Status |
|---|---|
| `agent` + identity meta (`domain`, `license`, `terms`, `privacy`) | 🛠️ In progress — `terms`/`privacy` parsed but not yet written to `aboutme.json` |
| `description` | ✅ Stable |
| `persona` | ✅ Stable |
| `behavior` (file pointer) | 🛠️ In progress — parsed but ignored; the compiler reads the file directly |

> **Deferred to v0.2 on purpose.** `capabilities`, `input`, `output`, `require`, and `type` already exist in the grammar but are *inert* today — nothing consumes them at runtime. They are not exposed as stable in v0.1; they activate alongside execution and access control, where they actually do something.

### Work to close v0.1

Tracked in [`tasks/pre-public-consolidation.md`](tasks/pre-public-consolidation.md):

- Resolve `merge` at runtime (kernel load path).
- `.description` honesty: write `terms`/`privacy`, wire the `behavior` block, **drop** the placeholder `purpose` field (returns later as a real feature — see *Distribution & identity*).
- Remove dead grammar/AST nodes (`on complete`/`on failed` standalone, `run … each`).
- **Stamp provenance into `aboutme.json`** — the *real* compiler version (today hardcoded `'dot-agent/1.0.0'`) and the **DSL version the bundle targets** (e.g. `0.1`). A bundle must record the language version it was authored against. This is small now but load-bearing: it is the seed that makes *editions* possible later (see [Evolution after v1.0](#evolution-after-v10--editions)). Also source `schemaVersion` from a constant instead of a literal.
- Packaging gates: `parser-dsl` `publishConfig`, and the version policy above.

---

## v0.2 — Typed & Executable `[next]`

Agents that do real work: typed data contracts, side-effecting execution, and the access model that gates it. This is the tier where `run` becomes meaningful — which is why typed I/O and access control land together with it.

| Capability | Theme (RFC) | Grammar? |
|---|---|---|
| Activate typed I/O — `capabilities`, `input`, `output`, `require` wired end-to-end | already in grammar | 🟢 no |
| Execution — `run script`/`subagent`/`tool`, `set`, `if`, `after N prompts`, `on event` | already in grammar | 🟢 no |
| `on failure` / `on success` across `run`/`parallel` (incl. fixing the dropped `on failure` on `apply`/`remove`) | already in grammar | 🟢 parser only |
| Access granularity on `require` (`read`/`write`/`create`) | [requires typing](rfcs/0008-requires-typing.md) | 🔬 depends on syntax decision |
| Rich types — multimodal (`image`/`audio`/`video`/`file`), collections (`array<T>`/`object`) | [Type System](rfcs/0005-type-system.md) | 🔴 yes |
| String constraints + semantic primitives — `string(format:…)`, `Email`, `Currency`, `Timestamp` | [String Constraints](rfcs/0016-string-constraints.md) | 🔴 yes |
| Standard library — `std.*` compound types | [Standard Library](rfcs/0017-standard-library.md) | 🟢 no |
| Data contract — `on intent … with Type`, `goal Capability`, `complete … with Type` | [Data Contract](rfcs/0014-data-contract.md) | 🔴 yes |
| Kernel protocol v2 — runtime owns memory, `serialize`/`restore` (checkpointing), SCXML graph | [Kernel Protocol](rfcs/0004-kernel-protocol.md) | 🟢 kernel only |

> The grammar-opening items here (🔴) are the reason to batch: open the **description/type** grammar once (rich types) and the **behavior** grammar once (data contract), then refreeze.

---

## v1.0 — Frozen `[stability target]`

The grammar becomes a public contract: a published `.agent` keeps working. We only cut v1.0 once rich types and data contracts are in — so the grammar is opened on the way to 1.0 and not after.

---

## Evolution after v1.0 — editions

Freezing the grammar at v1.0 is a stability commitment, **not** an evolution dead-end. The language can still gain breaking syntax (new keywords, changed forms) after 1.0 without invalidating any published `.agent` — using the **editions** model proven by Rust and Swift (language modes).

The mechanism:

- Every `.agent` records the **DSL version / edition it was authored against** (provenance stamped at pack time — the v0.1 work item above lays this foundation).
- A new edition (e.g. an `edition "2027"`) may introduce changes that would break older syntax.
- The toolchain supports **all editions simultaneously** — a bundle is parsed under the rules of the edition it declares. Old and new bundles coexist in the same runtime.

This is why v0.1 must stamp provenance correctly even though editions themselves are a post-1.0 concern: the escape hatch only works if every bundle, from the start, says which language version it speaks. Knowing this hatch exists is what makes committing to the v1.0 freeze safe.

> A formal editions design will get its own RFC and ADR when it is needed. It is named here so the freeze decision is made with the exit in view.

---

## Backlog (priority-ordered, unversioned)

Beyond v0.2 the order is by priority, not by a promised version number. Each lands when it is ready.

| Theme | What it adds | Status | Grammar? |
|---|---|---|---|
| **Cross-agent orchestration** | `start Capability [in "…"]`, `into context.var`, capability-based resolution | 📋 Planned (depends on Data Contract) — [RFC](rfcs/0015-cross-agent.md) | 🔴 yes |
| **In-process execution (Lib Format)** | `run lib "…" "method"` — WASM addons called from a flow | 📋 Planned (depends on Addon Protocol) — [RFC](rfcs/0002-lib-format.md) | 🔴 yes |
| **Addon protocol** | ID format, resolution (`builtin`/`bundle`/`online`), capability gating | 📋 Planned — [RFC](rfcs/0001-addon-protocol.md) | 🟢 no |
| **Knowledge / RAG** | `.knowledge` bundles, `QueryKnowledge` effect, tiered retrieval | 🔬 Exploring — [RFC](rfcs/0003-knowledge-format.md) | 🟢 no |
| **GenUI & Templates** | `apply`/`remove` beyond CSS — HTML fragments, templates, video layers | 🔬 Exploring — [RFC](rfcs/0007-genui-and-templates.md) | 🔴 yes |
| **Distribution & identity** | `purpose` (Wikidata QID), `endpoints`/`securitySchemes`, `.well-known`, `dot-agent://` scheme, `did` + `proof` signing | 📋 Planned / 🔬 Exploring — RFCs [0013](rfcs/0013-purpose-index.md) · [0009](rfcs/0009-endpoints.md) · [0010](rfcs/0010-well-known.md) · [0011](rfcs/0011-agent-pack.md) · [0012](rfcs/0012-identity-proof.md) | 🟢 mostly no |
| **Transpiler infrastructure** | `.agent` → LangGraph / Swift AppIntent codegen | 🔬 Exploring — [RFC](rfcs/0018-transpiler-infrastructure.md) | 🟢 no (separate packages) |

Unresolved architectural questions (dynamic `each` parallelism, authorization gates, timeouts, subagent contracts) are parked in the [Experimental Roadmap RFC](rfcs/0006-experimental-roadmap.md) until they become concrete proposals.
