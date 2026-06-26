# Task: Compiler Work — DA01-01 §4.3

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-06-25 |
| Author | Danilo Borges |
| Decision Log | [DA01-01: Forgiving Syntax and Prettifier](../pre-release/v0.1/DA01-01-forgiving-syntax.md) |
| Depends on | `DA01-01-grammar-unfreeze.md` (for items 2–4) |

Items 2–4 require the grammar unfreeze to be complete. Item 1 (Native States) has no grammar dependency and can ship now.

---

## 1. Native States — ship before unfreeze

**What:** Add `online`, `offline`, `ended` to the compiler linter's known-states allowlist so `transition to ended` does not emit `E005: Undefined state`.

**Change:** In `@dot-agent/compiler`, find the linter rule that validates transition targets and add the three native state names as built-in allowlist entries. Add a lint test for each.

**Why now:** Compiler is active (not frozen). This is a one-line allowlist change with zero grammar dependency. Every behavior file that uses `transition to ended` is currently broken in the linter.

---

## 2. AST Context for E006 — after unfreeze

**What:** Upgrade `E006` errors to include the AST context at the point of failure instead of reporting `line 1:1` with a Rust internal type name.

**Current:** `E006 (line 1:1): Failed to map tree to AST: data did not match any variant of untagged enum IntentBody`

**Target:** `E006 (line 12): AST mapping failed in state "collect_topic", on-intent handler "topic provided" — statement type "set" is not valid inside an intent block.`

**Change:** The AST mapper walks a known structure (state → body → handler → statements). Thread the current state name and handler context into the mapper and surface it in the error string when deserialization fails.

---

## 3. Error Code Reform (D4) — after AST Context

**What:** Distinguish grammar errors from semantic/mapper errors in user-facing messages so authors know which layer failed and what the fix path is.

**Current situation:** E004 (tree-sitter parse failure) and E006 (AST mapper failure) look identical to the author — both are a code and a terse message. The fix paths are completely different (grammar form vs. statement type), but nothing in the message signals which it is.

**Change:** Add a clear prose label to each error class:
- E004: prefix with `"Grammar error:"` or add `"(grammar)"` suffix
- E006: prefix with `"AST mapping error:"` or add `"(semantic)"` suffix

Evaluate whether a new code `E007` for mapper failures is preferable to sub-codes (`E006.mapper`). Record the decision here before implementing. The goal is that an author searching for the error code finds documentation that describes the correct fix path, not a description that reads like the other class.

---

## 4. Prettifier MVP — after unfreeze

**What:** Build `toCanonicalString(ast)` in `@dot-agent/compiler` using `web-tree-sitter` to re-serialize a parsed DSL file into the canonical, readable form.

**Why `web-tree-sitter` and not the Rust parser (`parser-dsl`):** Velocity and iteration speed for the MVP. While we could implement a `format()` function entirely in Rust and expose it via WASM, writing a prettifier involves rapid, heuristic-heavy iteration on spaces, newlines, and comment placement. Building the logic natively in TypeScript (where the compiler and LSP already live) using `web-tree-sitter`'s CST API allows for much faster iteration than recompiling the Rust parser for every tweak.

**Integration points (in order of priority):**
1. **CLI:** `dot-agent-cli format <file>` — batch formatting
2. **LSP:** wire `toCanonicalString` to `textDocument/formatting` for Format on Save
3. **Packer:** `pack` command strips comments from the output `.agent` ZIP but does NOT modify the source file on disk

**Comment repositioning:** when block order changes (e.g. D3/G7 relaxation means blocks arrive unordered), comments above a block must travel with that block. The formatter must identify each `//` comment node's following sibling and treat them as a unit.

**Scope for MVP:** canonical block order for `.description`, canonical newline placement for `on failure`, `parallel`, `if`. Comment round-trip. Format on Save via LSP. CLI flag. Do not implement comment repositioning across block boundaries in MVP — if a comment is out of canonical position, preserve it in place and emit a linter warning.

---

## Implementation order

```
1. Native States         ─ ship now, no dependency
      ↓ (unfreeze complete)
2. AST Context (E006)   ─ needs relaxed grammar to test correctly
3. Error Code Reform    ─ needs AST Context (builds on E006 upgrade)
4. Prettifier MVP       ─ needs relaxed grammar to canonicalize
```
