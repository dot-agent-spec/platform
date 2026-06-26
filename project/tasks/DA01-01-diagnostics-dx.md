# Task: Diagnostics & DX — DA01-01 §4.3

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-06-25 |
| Completed | 2026-06-26 |
| Author | Danilo Borges |
| Decision Log | [DA01-01: Forgiving Syntax and Prettifier](../pre-release/v0.1/DA01-01-forgiving-syntax.md) |
| Depends on | [DA01-01-ast-mapper-fixes.md](DA01-01-ast-mapper-fixes.md) |

Replaces the string-based error system with structured diagnostics across `parser-dsl` and `compiler`. Introduces 4 severity levels, multi-error collection, keyword-level hints in the parser, and semantic lint rules that take over from the constraints previously enforced by `tree-sitter`. Breaking change — no backward compatibility with the previous `{ "error": string }` WASM interface.

---

## Severity model

| Level | Prefix | Blocks `pack()`? | Description |
|---|---|---|---|
| Error | `E*` | Yes | FSM broken, packaging invalid — must fix |
| Warning | `W*` | No | Likely bug at runtime — advisory |
| Info | `I*` | No | Contextual awareness — changes default kernel behavior |
| Hint | `H*` | No | Proactive suggestion — possible typo, no error triggered |

---

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | DIAG-1 — `ParseDiagnostic` struct + WASM interface | `parser-dsl` | M |
| 2 | P0 | DIAG-2 — Multi-error collection | `parser-dsl` | S |
| 3 | P0 | DIAG-3 — Fix `1:1` source mapping (ER-1) | `parser-dsl` | S |
| 4 | P0 | DIAG-4 — Stop leaking Rust types (ER-2) | `parser-dsl` | XS |
| 5 | P0 | DIAG-5 — New semantic linter rules E009, W012, W013 (ER-3) | `compiler` | M |
| 6 | P0 | DIAG-6 — New codes E010, E011, W008 (Error) | `compiler` | S |
| 7 | P1 | DIAG-7 — Keyword fuzzy match hints in parser | `parser-dsl` | S |
| 8 | P1 | DIAG-8 — W009, W010, W011 | `compiler` | S |
| 9 | P1 | DIAG-9 — I001, I002 (lifecycle state info) | `compiler` | XS |
| 10 | P1 | DIAG-10 — H001, H002 (system + state name hints) | `compiler` | S |
| 11 | P0 | DIAG-11 — Update `lint-codes.md` | `compiler/docs` | S |

---

## Work items

### 1. DIAG-1 — `ParseDiagnostic` struct + WASM interface — P0

**What:** Replace `ParseError(String)` with a structured `ParseDiagnostic` type and update the WASM JSON contract accordingly.

**Why:** The current `{ "error": "string" }` interface buries position inside formatted text, making it impossible for the LSP and compiler to extract precise ranges for editor highlights without re-parsing the string. This is a pre-release unfreeze — born clean, no backward compat.

**Change in `parser-dsl/src/parser.rs`:**

```rust
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ParseDiagnostic {
    pub severity: Severity,
    pub code: String,               // "E004", "H001", etc.
    pub message: String,
    pub hint: Option<String>,       // "did you mean 'transition'?"
    pub start: Option<(usize, usize)>,  // (line, col), 1-based
    pub end: Option<(usize, usize)>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity { Error, Warning, Info, Hint }
```

**New WASM JSON contract** (breaking change):
- Success with no issues: `{ "ok": BehaviorFile, "diagnostics": [] }`
- Success with warnings/hints: `{ "ok": BehaviorFile, "diagnostics": [ParseDiagnostic, ...] }`
- Parse failure: `{ "ok": null, "diagnostics": [ParseDiagnostic, ...] }`

Update `wasm_parse_behavior` and `wasm_parse_description` in `lib.rs` to return this shape. Update all consumers (`compiler`, `language-server`) to read the new format.

### 2. DIAG-2 — Multi-error collection — P0

**What:** Replace `find_first_error` (early-exit) with `collect_all_errors` that walks the full tree and returns every `ERROR` and `MISSING` node.

**Why:** tree-sitter already parses the whole file with error recovery. Today we discard all errors after the first. Showing all of them removes iteration cycles where the user fixes one error and discovers the next.

**Change:** Replace `find_first_error(root_node) -> Option<Node>` with `collect_all_errors(root_node) -> Vec<Node>`. Each error node becomes one `ParseDiagnostic` with `severity: Error`, `code: "E004"`, its position, and any keyword hint (see DIAG-7). Return all of them in the `diagnostics` array.

### 3. DIAG-3 — Fix `1:1` source mapping (ER-1) — P0

**What:** Ensure every `ParseDiagnostic` carries the precise source position of the offending node, not a default `1:1`.

**Why:** The current error formatter sometimes falls back to a structural error message without a position when `col_num > line_text.len() + 1`. This produces diagnostics that point to `1:1`, making the editor underline the wrong location.

**Change:** In `collect_all_errors`, use `err_node.start_position()` and `err_node.end_position()` directly for all error nodes. For `MISSING` nodes, use the position of the parent node as `start` = `end` (zero-width range) so the editor inserts a marker at the right spot. Remove the out-of-bounds fallback that discards position.

### 4. DIAG-4 — Stop leaking Rust types (ER-2) — P0

**What:** Map `serde_json::from_value` deserialization errors to domain-specific `ParseDiagnostic` entries instead of exposing raw Rust type names.

**Why:** The current fallback `"Failed to map tree to AST: {e}"` surfaces Rust internals like `"expected variant identifier"` or `"unknown field 'on_complete_stmt'"`, which are meaningless to DSL authors.

**Change:** Replace the single `map_err(|e| ParseError(format!("Failed to map tree to AST: {}", e)))` with a match that inspects the serde error path and maps it to a domain message. Examples:
- Error on field `"handlers"` in `interact_stmt` → `"Expected 'on intent' or 'on offtopic' handler inside 'interact'"`
- Unknown variant → `"Unexpected statement type — this node kind is not valid here"`
- Missing field → `"Internal: AST field missing after parse. File a bug."`

Return these as `ParseDiagnostic` entries with `severity: Error`, `code: "E004"`, no position (position is lost at serde boundary — document this limitation).

### 5. DIAG-5 — New semantic linter rules (ER-3) — P0

**What:** Enforce in the `compiler` the structural constraints that `tree-sitter` previously caught as `E004` but now allows through (KD-1 to KD-5). These replace the `E004` scenarios documented in `lint-codes.md` under "Grammar constraints".

**Why:** With newlines as extras and flat `state_body`, these patterns parse successfully. `goal`-without-`interact` and `interact`-without-`goal` are Warning-level because the prettifier can auto-correct them — they are layout issues, not FSM logic errors. Missing `on intent` is an Error because the FSM has no valid routing path. `on offtopic` is optional (defaults to a kernel hold pattern).

**Change — add to `lintBehavior` in `compiler`:**

| Code | Level | Condition | Message |
|---|---|---|---|
| `W012` | Warning | `goal` found in a state without `interact` | `"'goal' is only valid in an oriented state. Add 'interact' or remove 'goal' — the prettifier can adjust this."` |
| `W013` | Warning | `interact` found without `goal` in the same state | `"'interact' without 'goal' — the prettifier will insert one. To set it explicitly, add 'goal \"...\"' before 'interact'."` |
| `E009` | Error | Oriented state (has `interact`) with no `on intent` handlers | `"Oriented state '<name>' has no 'on intent' handlers. At least one is required."` |

Oriented state is defined as: any state whose body contains an `interact` statement.

`on offtopic` is optional — omitting it delegates handling to the kernel's default hold pattern. Codes E012, E013, E014 are freed for future use. Note: existing `E008` ("Oriented state missing goal") covers the same condition as W013 — mark E008 as superseded by W013 in DIAG-11.

### 6. DIAG-6 — New codes E010, E011, W008 (Error) — P0

**What:** Add three new diagnostic rules to `lintBehavior`.

**Change:**

| Code | Level | Condition | Message |
|---|---|---|---|
| `W008` | **Error** | `on intent` with the same label declared more than once in the same state | `"Duplicate 'on intent \"<label>\"' in state '<state>'. The FSM cannot route ambiguous intents — use a unique label for each handler."` |
| `E010` | Warning | `parallel` block with no `run` statements in its body | `"'parallel' block in state '<state>' has no 'run' statements and does nothing."` |
| `E011` | Error | `after` statement with `prompts: 0` | `"'after 0' is invalid — prompts must be ≥ 1. Use 'after 1' for the next prompt."` |

For W008: build a per-state intent label frequency map when walking the AST. If any label appears more than once on the same state, emit W008 (Error level) for each duplicate occurrence.

### 7. DIAG-7 — Keyword fuzzy match hints in `parser-dsl` — P1

**What:** When an `ERROR` node contains text that is close (Levenshtein distance ≤ 2) to a known DSL keyword, attach a `hint` to the `ParseDiagnostic`.

**Why:** Typos in keywords (`trnasition`, `intercat`, `paralel`) produce unhelpful `E004` errors with no guidance. The parser has the token text and the keyword list — it can suggest the correction at zero semantic cost.

**Change:** Add a `keyword_hint(token: &str) -> Option<String>` function in `parser.rs` that checks against the hardcoded keyword list:

```
state, goal, guide, teach, interact, transition, to, on, intent, offtopic,
parallel, after, run, tool, script, subagent, set, apply, remove, if, else,
end, failure, background, silent, merge
```

For each `ERROR` node, extract the node's text, call `keyword_hint`, and if it returns `Some(kw)`, set `hint: Some(format!("did you mean '{kw}'?"))` on the `ParseDiagnostic`. Use a simple edit-distance implementation (no external crate needed for a 25-word list).

### 8. DIAG-8 — W009, W010, W011 — P1

**What:** Three new warning rules in `lintBehavior`.

**Change:**

| Code | Level | Condition | Message |
|---|---|---|---|
| `W009` | Warning | A state has no incoming transitions from any other state in the file (after merge), and is not the first declared state | `"State '<name>' is unreachable — no other state transitions to it."` |
| `W010` | Warning | A `guide` statement's text exceeds 280 characters | `"'guide' text in state '<name>' is <N> characters (limit: 280). Consider using an external file."` |
| `W011` | Warning | An `on intent` handler transitions to its own enclosing state | `"'on intent \"<label>\"' in state '<name>' transitions back to itself. The user expressed an intent but receives no progress — did you mean a different target state?"` |

For W009: build a set of all transition targets across the merged file. Any declared state not in that set (excluding the first) is unreachable.

For W010: `guide` joins the existing W002 check (which covers `goal`). Keep separate for clarity — W002 will also have its message updated in DIAG-11 to remove the LLM quality claim (same reasoning: the claim is model-specific and misleading).

For W011: applies only to `on intent` handlers, not `on offtopic`. Self-transition in `on offtopic` is a valid holding pattern by design.

### 9. DIAG-9 — I001, I002 (lifecycle state info) — P1

**What:** Emit `Info`-level diagnostics when a behavior file declares states that override the kernel's default lifecycle.

**Why:** The kernel has an internal lifecycle (`init → welcome → responsive`). If a `.behavior` file declares these states, the kernel defers to the file's definition instead of its default. This is expected and valid — the `Info` diagnostic is purely contextual, so the developer knows the override is active.

**Change — add to `lintBehavior`:**

| Code | Level | Condition | Message |
|---|---|---|---|
| `I001` | Info | A state named `init` is declared in the behavior | `"State 'init' overrides the kernel's default entry lifecycle. The kernel will use this definition instead of its built-in init sequence."` |
| `I002` | Info | A state named `end` is declared in the behavior | `"State 'end' overrides the kernel's default terminal lifecycle. The kernel will treat this state as the canonical exit point."` |

### 10. DIAG-10 — H001, H002 — P1

**What:** Two proactive `Hint`-level diagnostics that fire without a triggering error.

**Why:** These catch suspicious patterns that are valid syntax but likely mistakes, before the author runs into a runtime surprise.

**Change — add to `lintBehavior`:**

| Code | Level | Condition | Message |
|---|---|---|---|
| `H001` | Hint | A declared state name has Levenshtein distance ≤ 2 from a kernel lifecycle name (`init`, `welcome`, `end`, `online`, `offline`) but is not an exact match | `"State name '<actual>' resembles the kernel lifecycle name '<closest>'. If this is intentional, ignore this hint."` |
| `H002` | Hint | Attached as `hint` field on `E005` — a transition target is undefined but has Levenshtein distance ≤ 2 from a declared state name in the merged file | Appended to the E005 message: `"did you mean '<closest_state>'?"` |

For H002: the state name lookup uses the flat merged state list (same scope as E005, respects `docPath`). H002 is not a standalone diagnostic — it enriches the existing E005 entry's `hint` field.

### 11. DIAG-11 — Update `lint-codes.md` — P0

**What:** Rewrite `packages/compiler/docs/reference/lint-codes.md` to reflect the new severity model and all new codes.

**Change:**
- Add a "Severity levels" section documenting E/W/I/H and their `pack()` behavior
- Add all new codes: E009–E011, W008 (Error), W009–W013, I001–I002, H001–H002
- Update the "Grammar constraints that produce E004" section — mark the four oriented-state patterns as migrated: E009 (no on intent), W012 (goal outside oriented), W013 (interact without goal); note that `on offtopic` is now optional
- Mark `E008` as superseded by `W013` (same condition, now Warning-level; E008 can be removed from the active linter)
- Update `W002` message: remove "Long goals reduce LLM instruction quality" → `"Consider using 'teach' to load long goal text from an external file."`
- Document the new `ParseDiagnostic` JSON shape and the updated WASM contract
- **Document `E001`**: referenced in `apps/dot-agent-cli/README.md` as "Missing required field in `.description`" and in `docs/reference/types.md` for missing `category` on type declarations. Never implemented as a structured lint rule — the CLI currently throws `E_DESC: <error>` for description parse failures. Candidate for a proper `lintDescription` rule. Add to `lint-codes.md` as planned/unimplemented.
- **Document `E002`**: completely absent from all source code and documentation — no usage found anywhere. Document as reserved/free.
- **Document `E003`**: exists as `throw new Error('E003: File agent.description not found')` in both `packages/compiler/src/pack.ts` and `apps/dot-agent-cli/src/commands/run.ts` — but is absent from `lint-codes.md`. Add it to the table alongside `E007`.
- **E_DESC cleanup**: `apps/dot-agent-cli/src/commands/run.ts` throws `E_DESC: ${descResult.error}` for description parse failures — this ad-hoc code should become `E001` when that rule is implemented.
- Freed codes for future use: E012, E013, E014

---

## Implementation order

```
1. DIAG-1  — ParseDiagnostic struct + WASM contract  (foundation for everything)
2. DIAG-2  — Multi-error collection
3. DIAG-3  — Source mapping fix
4. DIAG-4  — Rust type leak fix
5. DIAG-5  — E009, W012, W013 semantic linter rules  (compiler, P0)
6. DIAG-6  — E010, E011, W008                        (compiler, P0)
7. DIAG-11 — lint-codes.md update                    (unblock docs review)
8. DIAG-7  — Keyword fuzzy match (parser-dsl)
9. DIAG-8  — W009, W010, W011
10. DIAG-9  — I001, I002
11. DIAG-10 — H001, H002
```

P0 items (1–7) form the shippable core. P1 items (8–11) can follow in the same batch or a follow-up depending on capacity.
