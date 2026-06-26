# Task: Pre-Public-Share Consolidation

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-06-22 |
| Author | Danilo Borges |
| Sources | [implementation-status.md](../../docs/explanation/architecture/implementation-status.md) · [build-pipeline-investigation.md](../../docs/explanation/research/build-pipeline-investigation.md) |

---

## Context

Consolidation pass before the repository is shared publicly. Two classes of work:

- **Build / packaging** — the toolchain is fragmented across three tracks with stale definitions, duplicated logic, and orphan artifacts. Catalogued in `build-pipeline-investigation.md`.
- **Correctness / DSL** — verified gaps where a DSL feature is parsed but dropped, hardcoded instead of derived, or duplicated across layers. Found while cross-checking `implementation-status.md` against package code.

Each item below was verified against source. Items touching `parser-dsl` and `kernel-dsl` cross a **frozen** package boundary (see freeze status) — those are flagged `🧊 needs unfreeze decision`.

---

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| B1 | **P0** — blocks publish | `parser-dsl` missing `publishConfig: {access: public}` | parser-dsl | XS |
| B2 ✅ | **P0** — release decision | Version strategy (0.4.1 / 0.1.3 / 0.1.0 diverge) | all | S |
| C3 | **P0** — wrong output | `files.json.behavior` hardcoded, ignores `DescriptionFile.behavior` | compiler | S |
| C2 | **P1** — feature broken e2e | `merge` parsed but not resolved at runtime | kernel-dsl, sdk | M |
| C1 ✅ | **→ DA01-01** | `on failure` on apply/remove dropped by parser | see `DA01-01-grammar-unfreeze.md` | — |
| B3 | **P1** — misleads contributor | Stale `wasm-pack` defs vs real `build-wasm.sh` | parser-dsl, kernel-dsl | S |
| B4 | **P1** — consumer DX | Rich wasm-bindgen `.d.ts` shadowed by thin stub | parser-dsl, kernel-dsl | S |
| B5 | **P1** — artifact confusion | `kernel-dsl/pkg-web/` orphan, unreferenced | kernel-dsl | XS |
| C4 | **P1** — placeholder shipped | `aboutme.purpose` hardcoded `'unknown'`, no DSL source | compiler | S |
| C5 | **P1** — duplication | Bundle validation duplicated compiler↔sdk | compiler, sdk | S |
| B6 | **P2** — dedup | UBSan stubs + wasm-bindgen patches written 3× | parser-dsl, kernel-dsl | M |
| B7 | **P2** — dedup | `build.rs` byte-identical across crates | parser-dsl, kernel-dsl | S |
| B8 | **P2** — DX / robustness | `tree-sitter` has no `.d.ts`; consumers type-assert | tree-sitter, compiler | S |
| C6 ✅ | **→ DA01-01** | Dead AST nodes: `OnComplete`/`OnFailed`/`RunStmt.each` | see `DA01-01-grammar-unfreeze.md` | — |

---

## Build / packaging

### B1. Add `publishConfig` to `parser-dsl` — P0

**What:** `parser-dsl/package.json` has no `publishConfig`, while `kernel-dsl` and `sdk` declare `{access: public}`.

**Why:** `kernel-dsl` links the parser-dsl `rlib` and the npm package re-exports it. A public release with parser-dsl unpublished (or published private) breaks the chain. Matches the `⚠️ not published` note in the parser-dsl section of the status doc.

**Change:** add `"publishConfig": { "access": "public" }` to `parser-dsl/package.json`. Confirm the package name/version is intended for the public registry.

### B2. Decide version strategy — P0

**What:** Versions diverge — tree-sitter `0.4.1`, kernel-dsl `0.1.3`, parser-dsl/compiler/sdk `0.1.0`.

**Why:** A coordinated public release needs an explicit policy: lockstep (align all to one version) vs. independent per-package semver. This is a decision, not code — record the outcome here.

**Decision (2026-06-22):** Two independent version axes — see [`ROADMAP.md` § Two version axes](../ROADMAP.md#two-version-axes). Recorded as [DA00-02](../adr/DA00-02-two-axis-versioning.md).

- **DSL version** is the public capability tier (`v0.1`, `v0.2`, … `v1.0`) — what docs and authors cite.
- **Package versions** stay per-package semver, but the **tens digit mirrors the DSL milestone**: `0.10.x` = DSL `v0.1`, `0.20.x` = DSL `v0.2`, … reaching `1.0` together. Within a tens band each package keeps its own minor/patch freedom.
- **Action at first public publish:** jump all packages to `0.10.x` (from the current `0.4.1` / `0.1.3` / `0.1.0` spread).
- Grammar stays *preview* while `0.x`; the public freeze is `v1.0`.

### B3. Remove stale `wasm-pack` build definitions — P1

**What:** Both Rust crates' `Cargo.toml` `[package.metadata.scripts]` declare a `wasm-pack build` command that is **not** what runs. The real build is `scripts/build-wasm.sh` (`cargo + wasm-bindgen + wasi-stub`, target `wasm32-wasip1`).

**Why:** Two conflicting build definitions in a public repo lead a first-time contributor to run the wrong one.

**Change:** delete the dead `wasm-pack` metadata, or replace it with a comment pointing to `build-wasm.sh`. Verify nothing else references it.

### B4. Stop shadowing the rich wasm-bindgen `.d.ts` — P1

**What:** `wasm-bindgen` emits a full `.d.ts` into `pkg/` (e.g. `kernel-dsl/pkg-web/dot_agent_kernel_dsl.d.ts`, ~6.5 KB), but the published root `index.d.ts` is a thin hand-written stub.

**Why:** SDK/kernel consumers get `string`-in/`string`-out signatures instead of the real typed surface.

**Change:** re-export the generated `pkg/*.d.ts` from the root types, or decide the stub is intentional (to hide internals) and document that. Same for parser-dsl.

### B5. Resolve the `pkg-web/` orphan — P1

**What:** `kernel-dsl/pkg-web/` is a second WASM output, older than `pkg/`, not referenced by `package.json` `files`/`exports`.

**Why:** Risk of shipping or confusing an abandoned artifact in a public package.

**Change:** confirm whether it is a maintained browser target. If yes, wire it into `exports`; if no, delete it and remove any generation step.

### B6. De-duplicate WASM post-processing — P2

**What:** UBSan env-stubs are written three times (parser-dsl inline `Proxy`; kernel-dsl `index.js` named list; kernel-dsl `index.browser.js` named list). The wasm-bindgen patches are duplicated (parser-dsl inline in `.sh`; kernel-dsl in `patch-wasm-bindgen.js`).

**Why:** Identical logic that drifts — a fix in one place silently misses the others.

**Change:** extract a single shared post-processing script and a single init wrapper consumed by both crates.

### B7. Share `build.rs` across crates — P2

**What:** `parser-dsl/build.rs` and `kernel-dsl/build.rs` are byte-for-byte identical (both codegen `node_kinds.rs` from `NODE_TYPES_BEHAVIOR`).

**Change:** move the shared codegen into one place (a small shared build crate or an `include!`d source) so the two cannot drift.

### B8. Give `tree-sitter` a `.d.ts` — P2

**What:** `@dot-agent/tree-sitter` ships no types; `compiler/src/parser.ts` type-asserts the `require(...)` result.

**Change:** add a small `index.d.ts` exporting `descriptionWasmPath` / `behaviorWasmPath` as `string`, and drop the cast in the compiler.

---

## Correctness / DSL

### C3. `files.json.behavior` ignores the `behavior` block — P0

**What:** `compiler/src/pack.ts` writes `files.json` with `behavior: 'agent.behavior'` (and `description: 'agent.description'`) as literals. The `.description` source already declares the behavior filename via the `behavior` block → `DescriptionFile.behavior`, which the compiler parses and then **discards**, reading the file directly instead.

**Why:** A bundle whose behavior file is named anything other than `agent.behavior` gets wrong metadata in `files.json`.

**Change:** use `df.behavior` (and the real `.description` source filename) when building `files.json`. Falls back to the literal only when the block is absent.

### C2. Resolve `merge` at runtime — P1

**What:** `merge` is parsed into `BehaviorFile.merges[]`, the compiler resolves it for lint, but the kernel does not resolve merge files at runtime and the SDK loads `files.behaviors[]` without passing them to the kernel.

**Why:** Multi-file behaviors lint clean but do not execute their merged states.

**Change:** wire merge resolution into the load path. Overlaps with `compiler-api.md` task 3 (`resolveMerges`) — coordinate so the SDK feeds resolved behavior to the kernel.

### C1. ~~Capture `on failure` on apply/remove~~ → moved to DA01-01

See [`tasks/DA01-01-grammar-unfreeze.md`](DA01-01-grammar-unfreeze.md) §4.2 item C1.

### C4. `aboutme.purpose` has no DSL source — P1

**What:** `purpose` is hardcoded to `'unknown'` in `pack.ts`; there is no `purpose` keyword in the grammar.

**Why:** Every published bundle carries a placeholder field.

**Change:** decide — add a `purpose` block to the DSL (grammar + parser, RFC if it's new syntax), or drop the field from `AboutMe`. Do not ship the placeholder.

### C5. De-duplicate bundle validation — P1

**What:** `validateMagicBytes` and `validateZipBomb` are defined in `compiler` (`zip.ts`) and **re-defined identically** in `sdk/src/load.ts` instead of imported.

**Change:** export them from `compiler/core` and import in the SDK; delete the SDK copies.

### C6. ~~Remove dead AST nodes~~ → moved to DA01-01

See [`tasks/DA01-01-grammar-unfreeze.md`](DA01-01-grammar-unfreeze.md) §4.2 item C6.

---

## Implementation order

```
P0:  B1 (publishConfig) ─ independent
     B2 (version policy) ─ decision, gates the actual publish
     C3 (behavior filename) ─ independent

P1:  C2 (merge runtime) ─ pairs with compiler-api.md task 3
     C4, C5, B3, B4, B5 ─ independent
     C1 + C6 ─ moved to DA01-01-grammar-unfreeze.md (parser-dsl unfreeze window)

P2:  B6, B7 ─ batch (shared build infra)
     B8 ─ independent
```

P0 items gate the public release. B6/B7 are best done in one shared-build-infrastructure pass.
