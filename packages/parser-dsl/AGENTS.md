# AGENTS.md — parser-dsl

`@dot-agent/parser-dsl` parses **both** DSL files — `.behavior` through `src/parser.rs` and
`.description` through `src/description_parser.rs`, each over its own tree-sitter language. It is layer 1:
above the grammar in [`packages/tree-sitter`](../tree-sitter/), below the compiler and the kernel. Built as
`cdylib` for WASM and `rlib` for Rust consumers such as `kernel-dsl`.

The public API is [`docs/reference/api.md`](docs/reference/api.md), which is where a signature is looked
up rather than restated here.

## Grammar quirks — the reason this file is worth reading

Two shapes in the CST are not what the source text looks like, and both have cost real debugging time.

**Handlers are siblings, not children.** In `.behavior`, `intent_handler` and `offtopic_handler` sit as
direct siblings in the state body — `Interact` is emitted with an **always-empty** `handlers` list beside
them, not containing them:

```text
state.body = [ Goal{…}, Interact{handlers: []}, OnIntent{…}, OnOfftopic{…} ]
                                       ↑ empty   ↑ siblings, not nested
```

`analysis.rs` handles both shapes; the note is at `src/analysis.rs:52`. **Never search for intents only
inside `Interact.handlers`** — use `get_intents_for_state`, which checks both.

**`.description` wraps declarations one level deeper.** Top-level nodes arrive as
`manifest → statement → agent_decl | type_decl`; `description_parser.rs` unwraps that intermediate
`statement` node before dispatching.

## Trailing newline normalization

Both parse entrypoints append `\n` when the input lacks one. Both grammars terminate statements with
newlines, so a file without a trailing newline makes tree-sitter insert a `MISSING _newline` node and set
`has_error` on otherwise valid input. Transparent to callers — the returned AST is unaffected.

## Building and testing

```bash
npm run build          # release; build:debug for the fast, larger binary
cargo test             # the rlib target — every unit test is an inline #[cfg(test)] fixture
npm test               # the JS side: browser-bundle integration
```

`npm run build` is not just the WASM step: it runs `cargo test`, then the **shared**
[`scripts/build-wasm.sh`](../../scripts/build-wasm.sh) at the repository root, then `tsdown`. The WASM
toolchain it needs is `rustup target add wasm32-wasip1`, `wasm-bindgen-cli`, `wasi-stub` and Zig CC.

The four `dead_code` warnings from the generated node-kind constants are expected — they are used only by
the WASM target. **Do not suppress them.**

## Following a grammar change

`dot-agent-tree-sitter` is a **path dependency** (`path = "../tree-sitter"`), so there is no version to
bump: rebuild it with `cd ../tree-sitter && npm run build` and a rebuild here picks it up. `build.rs`
regenerates the node-kind predicates on its own.

What does not follow automatically: a new construct needs its variant in `src/ast.rs` (**pure data — no
logic there, ever**), its CST mapping in `src/parser.rs` or `src/description_parser.rs`, and a case in
`src/analysis.rs` if it carries a transition or an intent.

Which *other* packages the change obliges you to update is
[`.agents/rules/doc-sync.md`](../../.agents/rules/doc-sync.md), which loads on its own.

## Common mistakes

- **Calling a WASM export before `await init()`** — it throws.
- **Adding logic to `src/ast.rs`** — it is the data layer; logic goes in the parsers or `analysis.rs`.
- **Assuming `Interact.handlers` holds the intents** — see the sibling quirk above.

## Keeping this file current

Updating it is part of any task that changes how this package parses or builds. Triggers: a grammar node
is renamed or added; a quirk above stops being true; the build pipeline moves; a new export appears.

**A renamed grammar node is the trigger that has already been missed once.** On 2026-08-13 this file, the
README and `docs/reference/api.md` still called the handler node `intent_trigger`, which the DA01-01
rename replaced with `intent_handler` — the code had moved in seventeen files while three documents in
this package kept the old name. This file is corrected; the other two are not, and are recorded in
`project/tasks/per-package-agents-md.md` (closed dossier — `git show 42ec13d03dd083f40b3e83916bdca51daef298c6:project/tasks/per-package-agents-md.md`).
