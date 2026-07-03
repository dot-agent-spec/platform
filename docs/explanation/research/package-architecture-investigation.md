<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# Investigation Brief: Package Architecture

> **Purpose of this document.** This is a *research brief* meant to be read with **zero prior context**. It records the **current, verified runtime/dependency structure** of the `dot-agent` packages — what depends on what, what each exposes, and what the artifacts cost. It contains **no recommendations and no decisions**: the goal is to hand a fresh investigation an accurate, unbiased map so it can reason about possible optimizations on its own terms.
>
> Every factual claim was verified against source on **2026-06-22** and cites its origin (paths relative to `packages/`). Unconfirmed items live under **Open questions**. (How each artifact is *built* is covered in the companion brief `build-pipeline-investigation.md`.)

---

## 1. The stack in one paragraph

`.agent` is a bundle (ZIP) describing an agent in a small DSL with two file kinds: `.description`/`.type` (declarative metadata) and `.behavior` (a state machine). A tree-sitter grammar provides syntax; a Rust parser turns source into typed ASTs; a Rust micro-kernel executes the behavior FSM and emits effects; TypeScript packages on top do linting + `.agent` packaging (compiler) and loading + dispatch (sdk). Consumers (e.g. an Electron runtime, a web demo, an LSP) sit above the sdk/compiler.

---

## 2. Verified dependency edges

Each edge below was confirmed by reading the importing code, not inferred from docs.

| From | To | Mechanism | Evidence |
|---|---|---|---|
| `compiler` | `parser-dsl` | npm, WASM API | `compiler/src/parser.ts:13` imports `init, parse_behavior, parse_description, get_graph` from `@dot-agent/parser-dsl` |
| `compiler` | `tree-sitter` | npm, **direct** | `compiler/src/parser.ts:16` `require('@dot-agent/tree-sitter')` for `descriptionWasmPath`, `behaviorWasmPath` (with a manual type cast) |
| `parser-dsl` (Rust) | `tree-sitter` (Rust) | crate dep + build dep | `parser-dsl/Cargo.toml` `[dependencies]` and `[build-dependencies]` both list `dot-agent-tree-sitter` |
| `kernel-dsl` (Rust) | `parser-dsl` (Rust) | **rlib, embedded** | `kernel-dsl/src/engine/{mod,memory,fsm}.rs` use `dot_agent_parser_dsl::{...}`; statically linked into kernel WASM |
| `kernel-dsl` (Rust) | `tree-sitter` (Rust) | build dep (used) + runtime dep (**unused?**) | see §5 |
| `sdk` | `compiler` | npm, **`/core` subpath** | `sdk/src/load.ts:16` and `sdk/src/types.ts:15` import from `@dot-agent/compiler/core` |
| `sdk` | `kernel-dsl` | npm, WASM API | `sdk/package.json` dep; `sdk/tsup.config.ts` marks it `external` |

### Diagram (verified edges only)

```
tree-sitter ──rlib──→ parser-dsl ──rlib (embedded)──→ kernel-dsl
     │                     │                                │
     │ npm (WASM paths)    │ npm (WASM API)                 │ npm (WASM class)
     ▼                     ▼                                ▼
  compiler ◀───────────────┘                              sdk
     │  └── exports "./core" ──────────────────────────────┘
     │                          (sdk imports compiler/core)
     ▼
  language-server (uses compiler)
```

Note the two **direct** edges into `tree-sitter`: one from `parser-dsl` (Rust) and one from `compiler` (npm). `compiler` therefore reaches tree-sitter both directly *and* transitively through `parser-dsl`.

---

## 3. What each package exposes (verified)

- **`tree-sitter`** — `index.js` exports two FS paths only: `descriptionWasmPath`, `behaviorWasmPath`. Rust lib additionally exposes `language_description()`, `language_behavior()`, `NODE_TYPES_BEHAVIOR`. No `.d.ts`.
- **`parser-dsl`** — `init()`, `parse_behavior`, `parse_description`, `get_graph`, `get_states`, `get_intents_for_state` (all `string`→`string`). `exports`: `.` only.
- **`kernel-dsl`** — `init()` + class `AgentDSLKernel` (methods: `load_behavior`, `send_intent`, `send_event`, `send_complete`, `send_failed`, `send_offtopic`, `set_memory`, `get_current_state`, `get_graph`, `get_memory`, `get_valid_intents`, `observe`, `tick_prompt`, `free`). `exports`: `.` with a `"browser"` condition → `index.browser.js`.
- **`compiler`** — `exports`: `.` (full) **and** `./core` (browser-safe subset). `./core` is what `sdk` consumes; the full entry pulls in `jszip` (ZIP packing) and is heavier.
- **`sdk`** — `exports`: `.` only. Loads `.agent` bytes, drives the kernel, dispatches effects.

`compiler` is the **only** package that already ships a **subpath-export split** (`.` vs `./core`), and that split is load-bearing: it is how `sdk` stays browser-safe while reusing compiler logic.

---

## 4. Artifact sizes (verified on disk)

| Artifact | Bytes |
|---|---|
| `tree-sitter-behavior.wasm` | 31,504 |
| `tree-sitter-description.wasm` | 42,659 |
| `parser-dsl` WASM | 604,094 |
| `kernel-dsl` WASM (`pkg/`, embeds parser-dsl) | 2,272,385 |

> `pkg-web/` (a separate, older build target, 1,830,452 bytes as of this brief) was removed during
> the DA00-06 build-pipeline consolidation (2026-07-02) — `pkg/` is now the only kernel-dsl WASM
> output.

`kernel-dsl` (2.17 MB) statically embeds the `parser-dsl` rlib. The same parser logic therefore exists twice in a deployment that loads both `parser-dsl` WASM (via compiler) and `kernel-dsl` WASM (via sdk): once standalone (590 KB) and once embedded inside the kernel.

---

## 5. The kernel→tree-sitter dependency (needs care)

`kernel-dsl/Cargo.toml` lists tree-sitter in **two** places:
- `[dependencies]`: `tree-sitter = "0.25"` **and** `dot-agent-tree-sitter = { path = "../tree-sitter" }`
- `[build-dependencies]`: `dot-agent-tree-sitter = { path = "../tree-sitter" }`

Verified facts:
- `grep` for `tree_sitter` / `tree-sitter` in `kernel-dsl/src/` → **no results**. The runtime crate is not referenced in kernel source.
- The **build** dependency *is* used: `kernel-dsl/build.rs` imports `NODE_TYPES_BEHAVIOR` from `dot_agent_tree_sitter` for codegen.

So the `[build-dependencies]` entry is justified, but the two `[dependencies]` entries (`tree-sitter` and `dot-agent-tree-sitter`) appear unused by kernel source. Whether they are dead, or required transitively/for linkage of the embedded parser rlib, is unconfirmed.

---

## 6. Consumer-facing shape (verified + context)

- A tool that **reads/validates/packages** `.agent` files uses `compiler` (lint, graph, ZIP pack/unpack). A tool that **runs** them uses `sdk` (which itself pulls `compiler/core` + `kernel-dsl`).
- `language-server` depends on `compiler` and does **not** use the kernel.
- The reference Electron runtime and a prospective web demo are described in project notes as needing **both** validation (compiler) and execution (sdk). This is context from project docs, not something re-verified in the runtime source during this pass — treat as a lead, not a fact.

---

## 7. Version skew (verified)

Independent versions across packages that ship together: `tree-sitter` 0.4.1, `kernel-dsl` 0.1.3, `parser-dsl` 0.1.0, `compiler` 0.1.0, `sdk` 0.1.0. There is no lockstep versioning; a consumer composes them by `"*"` ranges (see each `package.json` `dependencies`).

> This is now a deliberate, written policy rather than organic drift — see
> [DA00-02: two-axis versioning](../../../project/adr/DA00-02-two-axis-versioning.md). Independent
> per-package semver is kept on purpose (option C in that ADR); the "tens digit mirrors the DSL
> milestone" rule is the only coordination point, applied at each public release.

---

## 8. Open questions (to be investigated, not yet answered)

- `compiler` imports `tree-sitter` directly *and* depends on `parser-dsl` (which already wraps tree-sitter). Is the direct edge necessary (e.g. compiler needs grammar WASM paths for its own tree-sitter pass) or removable?
- Can `compiler`'s syntactic linting route entirely through `parser-dsl`, eliminating its direct tree-sitter dependency? What does `compiler/src/parser.ts` actually do with the WASM paths?
- Are the kernel's `[dependencies]` tree-sitter entries dead? (See §5.) What breaks if removed?
- `parser-dsl` is materialized twice in a full deployment (standalone 590 KB + embedded in the 2.17 MB kernel). Is the standalone copy avoidable for consumers that already load the kernel — e.g. could the kernel re-expose parsing?
- `compiler` already proves the subpath-export pattern (`.` + `./core`). Where else would a `/core`-style split reduce what a browser consumer downloads (e.g. a parser-dsl `/core` without tree-sitter init)?
- `compiler` and `sdk` are separate npm packages but every described consumer needs both. Is the package boundary between them load-bearing, or an artifact of independent evolution? What relies on importing one without the other today (besides `language-server`, which needs only compiler)?
- Is there a lazy-load story for the 2.17 MB kernel WASM, or is `initKernel()` always eager? What is the first-load cost for a browser consumer?
- Does the version skew (§7) cause any real compatibility coupling (e.g. sdk assuming a compiler/kernel data-format version)?

---

*Companion brief: `build-pipeline-investigation.md` (how the artifacts are produced).*
