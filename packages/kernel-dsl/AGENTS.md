# @dot-agent/kernel-dsl — Agent Guidelines

The Rust/WASM execution engine: parses `.behavior` and runs it as an FSM, exposed to JavaScript through
`wasm-bindgen`. The language it implements is specified in [`dsl/reference/`](../../dsl/reference/); the
grammar it mirrors is [`packages/tree-sitter`](../tree-sitter/).

## How this package works — not obvious from the code

- **The target is `wasm32-wasip1`, not `wasm32-unknown-unknown`.** Tree-sitter's C runtime requires it.
  That triple brings **no `libc`, no filesystem, no threads**, so every runtime dependency must be
  WASM-compatible — verify before adding to `[dependencies]`. `[build-dependencies]` are exempt: they run
  on the host during compilation.
- **`BTreeMap`, never `HashMap`.** `HashMap` seeds itself through WASI's `random_get`, which this binary
  does not have. This is not a style preference — it was a real runtime trap, and swapping the data
  structure is what removed the import.
- **`src/lib.rs` holds `#[wasm_bindgen]` bindings and nothing else.** Parser and FSM logic never go there,
  and internal structs are never exposed directly — serialize with `serde_wasm_bindgen::to_value`.
- **`pkg/` is generated.** Never edit anything inside it.

## Building

```bash
npm run build          # release; npm run build:debug for the debug profile
```

Not `wasm-pack`. The script runs `cargo test`, then the shared
[`scripts/build-wasm.sh`](../../scripts/build-wasm.sh), then `tsdown`. Three things in that pipeline are
worth knowing before touching it:

- **`wasi-stub` runs on the output**, from the vendored copy at [`tools/wasi-stub/`](../../tools/wasi-stub/)
  — `0.3.0-patched`, not the upstream release. It was once removed in favour of a hand-written JavaScript
  WASI shim, and that removal did not survive; the trap is
  [`project/log/wasi-stub-removed-then-restored-vendored.md`](../../project/log/wasi-stub-removed-then-restored-vendored.md).
  Read it before concluding the step is unnecessary.
- **The `wasm-bindgen` output is patched in place**, by an inline `node -e` block inside `build-wasm.sh`.
  It strips the direct WASM imports that break bundlers, and fixes a stale-memory-view bug after
  `memory.grow()`. Deleting it produces output that imports correctly and reads freed memory.
- **`build.rs` generates node kinds** from tree-sitter's `node-types.json` at compile time, so the
  statement-kind lists follow the grammar with no manual edit.

## Following a grammar change

`dot-agent-tree-sitter` is a **path dependency** (`path = "../tree-sitter"`), so there is no version to
bump and `cargo update` changes nothing — a rebuild picks the grammar up. What a rebuild cannot do is the
semantic half: a new construct needs `src/parser/ast.rs` (the variant and its serde rename, which must
match the grammar's node kind), `src/parser/mod.rs` (CST → AST, where the special cases live),
`src/engine/fsm.rs` (execution) and `src/effect.rs` (only if it produces a new effect).

Which *other* packages a change here obliges you to update is
[`.agents/rules/doc-sync.md`](../../.agents/rules/doc-sync.md), which loads on its own.

## Publishing

Never `npm publish` by hand. The workflow triggers on a pushed tag matching `kernel-dsl@*`; the release
runbook is the `/publish` skill.

## Source of truth

| What | Where |
|---|---|
| Language syntax and semantics | [`dsl/reference/`](../../dsl/reference/) |
| The grammar this parser mirrors | [`packages/tree-sitter`](../tree-sitter/) |
| Effects the kernel emits | `src/effect.rs` — the code is canonical |
| Licence rules | root [`AGENTS.md`](../../AGENTS.md); `pkg/` is untracked so the check never reaches it |

## Keeping this file current

Updating it is part of any task that changes how this package is built or bound. Triggers: the target
triple or a build step changes; a runtime dependency is added; the `wasm-bindgen` patching moves; the
publish trigger changes; an invariant above stops being true. Adjust the one affected line.

This file was rebuilt on 2026-08-13 after six of its claims were found false against the disk — including
a "do not delete this script" guarding a file that no longer existed, and a target triple the same file
contradicted eleven lines later. Prefer correcting a line over appending one.
