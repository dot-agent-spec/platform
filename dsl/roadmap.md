# DSL Roadmap

Upcoming evolution stages for the consolidated specification.

---

## Stage 1 — Reorganization and document consolidation ✅

- [x] Create `dsl-old/` with backup of previous state
- [x] Move `flow-lang/` to `dsl-old/`
- [x] Rename `DSL/` → `dsl/`
- [x] Incorporate `.flow` spec into `dsl/` (`grammar.flow.md`, `language.flow.md`, `manifesto.md`)
- [x] Create `README.md` and `roadmap.md`

---

## Stage 2 — Vocabulary / Syntax revision ✅

- [x] Decide keyword and semantics for flow composition → `merge "file.flow"` (preamble, eager)
- [x] Remove `run flow` from `run_type` in `grammar.flow.md`
- [x] Add `merge_decl` to the top-level of `grammar.flow.md`
- [x] Update `language.flow.md` — §3 (flat states), §4 (IDE doc links), new composition subsection
- [x] `grammar.agent.md` unaffected — `behavior` kept as-is
- [x] No lazy loading — complex cases delegated to `.run` / WASM

---

## Stage 3 — Spec text consolidation ✅

- [x] Merge `language.agent.md` + `language.flow.md` + `manifesto.md` → unified `language.md` (English)
- [x] Clarify `.flow` / `.run` relationship: same purpose, text subset vs. compiled WASM
- [x] Add deprecation notices to `grammar.agent.md` and `grammar.flow.md`
- [x] Fix broken links in grammar files (old `grammar.md` and `DSL/` path references)
- [x] Remove "How to use this documentation?" section from `grammar.flow.md`
- [x] Update `README.md` for new file structure
- [x] Note `.logic` → `.run` rename still needed in `org-spec/` (separate submodule)

---

## Stage 4 — Tree-sitter ✅

- [x] Resolve open question: `project` → `worksession` memory domain name — aligned in `grammar.flow.md` and `language.md`
- [x] Create tree-sitter grammar for `.flow` — `dsl/tree-sitter-agent/flow/grammar.js` (10/10 tests passing)
- [x] Align `tree-sitter-agent/grammar.js` with updated spec — `?` moved before `:`, `agent_meta_key`/`optional_marker`/`run_type`/`assignment_op` as named rules (8/8 tests passing)
- [x] Unified both parsers in `dsl/tree-sitter-agent/` — `flow/` subdirectory, `tree-sitter.json` updated
- [x] Rename local directory `tree-sitter` → `tree-sitter-agent` so tree-sitter CLI discovers it as a grammar package
- [x] Delete `grammar.agent.md` and `grammar.flow.md` — `dsl/tree-sitter-agent/` is now the canonical grammar source
- [x] Fix `text_content` precedence (`prec(-1)` removed) — accents and punctuation in `description` blocks no longer produce ERROR nodes in the editor

---

## Stage 5 — Extensions (VS Code / Zed) ✅

- [x] Consolidate `dsl-old/flow-lang/syntax/` and `dsl/vscode-extension/` into a single extension supporting both `.agent` and `.flow`
- [x] Update Zed extension (`dsl/zed-agent/`) to include `.flow` highlighting
- [x] Extract all IDE logic into a standalone Language Server (`dsl/language-server/`, submodule at `github.com/daniloborges/language-server`) — VS Code and Zed extensions rewritten as thin LSP clients

---

## Stage 6 — Examples ✅

- [x] Add a companion `.flow` file for each example in `dot-agent-spec/examples/` (previously only `.agent`) — each example organized in its own folder
- [x] Examples in `dsl-old/flow-lang/examples/` were internal drafts of `builder.agent`; lifecycle and planning sub-flow were incorporated directly into `builder.flow`
- [ ] Evaluate moving `dsl-old/flow-lang/compiled/` to `dot-agent-spec/` as a compilation reference

---

## Stage 7 — Contracts

- [ ] **[Spec fix]** Resolve the Hidden Return Contract ambiguity: add to the spec the requirement for explicit injection syntax for subagent outputs (e.g. `run subagent "Name" into context.target`).
- [ ] Resolve open question: `project` vs `worksession` memory domain name — align grammar and spec. Recommended: adopt `worksession` globally due to AI task isolation semantics.
- [ ] **[Enhancement]** Add initial grammar support for resilience properties (e.g. `timeout` as a reserved keyword accepted in tool and subagent execution blocks).

---

## Stage 8 — Extensions (VS Code / Zed) ⚙️ (Focus: UX and dev safeguards)

- [ ] **[Linter]** Implement static analysis rule in the Language Server to warn when a custom type shadows a native type (`std.*`)
- [x] **[Language Server]** Published as standalone submodule at `github.com/daniloborges/language-server` — supports VS Code, Zed, Neovim, and any LSP-capable editor
- [x] **[VS Code Extension]** Published as standalone submodule at `github.com/daniloborges/vscode-dot-agent` — v1.4.0
- [x] **[Document Symbols]** VS Code Outline populated for `.agent` (agent + types) and `.flow` (states + events) via `DocumentSymbol` format (modern LSP, no URI hack)
- [x] **[Document Links]** Clickable links implemented via `documentLinkProvider` in the Language Server:
  - `.agent`: `behavior <file>`, `schema <file>` — resolved relative to the document directory
  - `.flow`: `merge "<file>"`, `run script "<file>"` — same
- [x] **[Word boundary]** `wordPattern` added to `.flow` so state names with dots (`planning.context`) are selected as a unit on Ctrl+Click / go-to-definition
- [x] **[Packaging]** `.vscodeignore` fixed to include all `node_modules` — transitive dependencies (`vscode-languageserver`, `balanced-match`, etc.) were missing from the `.vsix`, preventing the LSP server from starting
- [ ] Remove logs from the output panel
- [ ] Add links and linter for `guide` and `teach`
- [ ] Publish updated VS Code extension to the marketplace

---

## Stage 9 — Examples 🧪 (Focus: practical validation and complex cases)

- [ ] **[Architect validation]** Ensure new example `.flow` files use the new `into` assignment syntax for subagents, validating data lineage in practical examples.
- [ ] **[Antipattern docs]** Include in the examples documentation a use case demonstrating "When to migrate from `.flow` to `.run`", applying the practical cognitive-density threshold (e.g. showing a flow that would require complex loops being elegantly replaced by a WASM-compiled module).
