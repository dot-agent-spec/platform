# Lint Codes Reference

All diagnostic codes emitted by `lintDescription` and `lintBehavior`.

---

## Severity levels

| Level | Prefix | Blocks `pack()`? | Description |
|---|---|---|---|
| Error | `E*` | **Yes** | FSM broken or packaging invalid — must fix |
| Warning | `W*` | No | Likely bug at runtime — advisory |
| Info | `I*` | No | Contextual — overrides default kernel behaviour |
| Hint | `H*` | No | Proactive suggestion — possible typo, no error triggered |

**Note:** Code `W008` is Error-level despite its `W` prefix (it produces `severity: 'error'`). This is intentional — the prefix reflects its origin as a warning-class rule that was promoted.

---

## WASM parser diagnostic shape

The `parse_behavior` and `parse_description` WASM exports use this JSON contract (breaking change from DA01-01):

```json
{ "ok": BehaviorFile | null, "diagnostics": [ParseDiagnostic, ...] }
```

A `ParseDiagnostic` has the shape:

```typescript
interface ParseDiagnostic {
  severity: 'error' | 'warning' | 'info' | 'hint'
  code: string          // "E004", "H001", etc.
  message: string
  hint?: string         // "did you mean 'transition'?"
  start?: [number, number]  // [line, col] 1-based; absent for serde-boundary errors
  end?: [number, number]
}
```

The old `{ "error": string }` envelope is removed.

---

## Error codes

| Code | File | Status | Description |
|---|---|---|---|
| `E001` | `.description` | Planned | **Missing required field.** A required field in the agent manifest is absent. Currently thrown as `E_DESC: <msg>` in `apps/dot-agent-cli/src/commands/run.ts` — not a structured lint rule yet. Candidate for `lintDescription`. |
| `E002` | — | Reserved | **Unassigned.** No usage found anywhere. Free for future use. |
| `E003` | `.description` | Unstructured | **Description file missing.** Thrown as `throw new Error('E003: File agent.description not found')` in `compiler/src/pack.ts` and `apps/dot-agent-cli/src/commands/run.ts`. Not emitted as a `LintMessage`. |
| `E004` | `.description` / `.behavior` | ✅ | **Syntax error.** Tree-sitter `ERROR` or `MISSING` node. Message includes position, snippet, and grammar hint. Multi-error collection: all errors in the file are reported, not just the first. |
| `E005` | `.behavior` | ✅ | **Transition to undefined state.** `transition to <name>` references a state not declared locally or in merged files. Enriched with H002 hint when a close match exists. |
| `E006` | `.behavior` | ✅ | **Parse error from kernel.** The WASM parser returned `ok: null`. Indicates a semantic inconsistency the grammar cannot catch. |
| `E007` | — | Unstructured | **Behavior file missing.** Thrown during `pack()` — not a `LintMessage`. |
| `E008` | `.behavior` | **Superseded by W013** | Oriented state missing `goal`. Same condition, downgraded to Warning in DA01-01. |
| `E009` | `.behavior` | ✅ | **Oriented state with no `on intent` handlers.** A state has `interact` but zero `on intent` handlers. The FSM has no valid routing path. |
| `E010` | `.behavior` | ✅ | **`parallel` block has no `run` statements.** (Warning-level) Will execute immediately with no effect. |
| `E011` | `.behavior` | ✅ | **`after 0 prompts`.** Zero prompts will never trigger. Use `after 1` or higher. |
| `E012` | `.behavior` | Planned (DA01-02) | **Merge target not found.** Path declared in `merge` does not exist on disk. |
| `E013` | `.behavior` | Planned (DA01-02) | **Circular merge dependency.** DFS detected a cycle in the merge graph. |
| `E014` | `.behavior` / `.description` | Planned (DA01-02) | **External path.** `merge` path or `behavior <path>` escapes the agent root (relative `../..` escape or absolute path). |
| `E015` | `.behavior` (consolidated) | Planned (DA01-02) | **Duplicate state name across merged files.** Two or more files in the merge chain declare the same state. |
| `E016` | `.behavior` (consolidated) | Planned (DA01-02) | **`init` state missing.** The consolidated behavior has no state named `init`. |
| `E017` | `.description` | Planned (DA01-02) | **Multiple `behavior` declarations.** Only one `behavior` block is allowed per `.description` file. To combine multiple files, use `merge` in your `.behavior` file. Emitted in `description_parser.rs` on the second `behavior_block` node. Resolves [platform#1](https://github.com/dot-agent-spec/platform/issues/1). |

---

## Warning codes

| Code | File | Status | Description |
|---|---|---|---|
| `W001` | `.behavior` | ✅ | **Isolated state.** No incoming and no outgoing transitions — unreachable and a dead end. |
| `W002` | `.behavior` | ✅ | **`goal` text exceeds 280 characters.** Consider using `teach` to load long goal text from an external file. |
| `W003` | `.description` | ✅ | **Default domain value.** The `domain` field is still `"example.com"`. |
| `W004` | `.description` | ✅ | **Undeclared type reference.** Type name in `input`/`output`/`requires`/`capabilities` is not declared locally. |
| `W005` | `.behavior` | ✅ | **External state reference.** Transition target contains dots — interpreted as cross-behavior reference, cannot be validated locally. |
| `W006` | `.behavior` | ✅ | **Dead-end `interact`.** No `on intent` or `on offtopic` handlers — agent will trap. |
| `W007` | `.description` | ✅ | **No domain declared.** Agent will be packaged as `unknown/name`. |
| `W008` | `.behavior` | ✅ **(Error-level)** | **Duplicate `on intent` label in same state.** The FSM cannot route ambiguous intents — each label must be unique per state. |
| `W009` | `.behavior` | ✅ | **Unreachable state.** No transition from any other state leads to it, and it is not the first declared state (entry point). Complements W001: W001 catches isolated states, W009 catches orphaned entry points. |
| `W010` | `.behavior` | ✅ | **`guide` text exceeds 280 characters.** Consider using `teach` to load guidance from an external file. |
| `W011` | `.behavior` | ✅ | **`on intent` self-transition.** Handler transitions back to its own enclosing state. The user expressed an intent but receives no progress. |
| `W012` | `.behavior` | ✅ | **`goal` in non-oriented state.** `goal` is only valid in states that also have `interact`. The prettifier can adjust this. |
| `W013` | `.behavior` | ✅ | **`interact` without `goal`.** The prettifier will insert one. Supersedes E008 (same condition, downgraded to Warning). |

---

## Info codes

| Code | File | Status | Description |
|---|---|---|---|
| `I001` | `.behavior` | ✅ | **State `init` overrides kernel lifecycle.** The kernel will use this definition instead of its built-in init sequence. |
| `I002` | `.behavior` | ✅ | **State `end` overrides kernel lifecycle.** The kernel will treat this state as the canonical exit point. |

---

## Hint codes

| Code | File | Status | Description |
|---|---|---|---|
| `H001` | `.behavior` | ✅ | **State name resembles a kernel lifecycle name.** Levenshtein distance ≤ 2 from `init`, `welcome`, `end`, `online`, or `offline`. If intentional, ignore. |
| `H002` | `.behavior` | ✅ | **Possible typo in transition target.** Not a standalone diagnostic — enriches the `hint` field on an `E005` message when the undefined target has Levenshtein distance ≤ 2 from a declared state name. |

---

## Grammar constraints (DA01-01 migration note)

Prior to DA01-01, the following patterns were caught by tree-sitter as `E004` due to strict grammar rules:

| Pattern | Was E004 | Now |
|---|---|---|
| `goal` outside oriented state | ✅ | W012 (linter) |
| `interact` without `goal` | ✅ | W013 (linter) |
| No `on intent` handlers | ✅ | E009 (linter) |
| No `on offtopic` handler | ✅ | Optional — kernel holds by default |

With newlines-as-extras and flat `state_body`, these patterns now parse successfully. The linter enforces the semantic constraints instead of the grammar.

`E_DESC` cleanup: `apps/dot-agent-cli/src/commands/run.ts` throws `E_DESC: ${descResult.error}` for description parse failures — this ad-hoc code should become `E001` when that rule is implemented.
