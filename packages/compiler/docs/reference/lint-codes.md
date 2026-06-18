# Lint Codes Reference

All diagnostic codes emitted by `lintDescription` and `lintBehavior`.

Errors (`E*`) block packaging — `pack()` throws if any are present. Warnings (`W*`) are advisory and do not block packaging.

---

## Error codes

| Code | File | Description |
|------|------|-------------|
| `E004` | `.description` / `.behavior` | **Syntax error.** The tree-sitter parser produced an `ERROR` or `MISSING` node. The message includes the offending snippet and a grammar hint when the node type is recognisable (e.g. missing `goal`, missing `on offtopic`). |
| `E005` | `.behavior` | **Transition to undefined state.** A `transition to <name>` references a state that is not declared in this file (or in any merged files when `docPath` is provided). |
| `E006` | `.behavior` | **FSM semantic error from kernel.** The `@dot-agent/kernel-dsl` engine reported a `parse_error` effect when loading the behavior. This indicates a semantic inconsistency the grammar cannot catch. |
| `E007` | — | **Behavior file missing.** The `agent.behavior` file was not found in the agent directory during `pack()`. |
| `E008` | `.behavior` | **Oriented state missing `goal`.** A state declares `interact` (making it an oriented state) but does not include a required `goal "..."` statement. The message names the offending state. |

---

## Warning codes

| Code | File | Description |
|------|------|-------------|
| `W001` | `.behavior` | **State has no transitions.** The FSM kernel reports a state that has neither incoming nor outgoing transitions, making it unreachable or a dead end. |
| `W002` | `.behavior` | **Text content exceeds 280 characters.** The quoted string inside a `goal` or `guide` statement is longer than 280 characters. Long goals reduce LLM instruction quality. |
| `W003` | `.description` | **Default domain value.** The `domain` field in the agent manifest still has the placeholder value `"example.com"`. |
| `W004` | `.description` | **Undeclared type reference.** A type name used in an `input`, `output`, `requires`, or `capabilities` block is not declared as a `type` in this file. The compiler assumes it is a native or external type. |
| `W005` | `.behavior` | **External state reference.** A transition target contains dots (e.g. `other.behavior.state`), which the compiler interprets as a cross-behavior reference. These cannot be validated locally. |
| `W006` | `.behavior` | **Dead-end `interact`.** A state calls `interact` but has no `on intent` or `on offtopic` handlers. The agent will be stuck waiting for input it can never route. |
| `W007` | `.description` | **No domain declared.** The agent manifest has no `domain` field. The agent will be packaged as `unknown/name`. Interoperability between runtimes is not guaranteed. See [agent-id.md — Tier 4](../../../docs/reference/agent-id.md#tier-4--unknown). |

---

## Grammar constraints that produce E004

The most common sources of `E004` in behavior files:

- **`goal` outside an oriented state** — `goal` is only valid as the first statement of an `oriented_state_body`. It cannot appear in transit states (those using only `transition to`, `set`, `run`, etc.).
- **`interact` without `goal`** — every `oriented_state_body` must begin with `goal`. Adding `interact` alone is a syntax error.
- **Missing `on offtopic`** — every oriented state must end with an `on offtopic` handler. Omitting it produces a MISSING node.
- **Missing `on intent`** — `repeat1(intent_handler)` means at least one `on intent` handler is required before `on offtopic`.

These constraints exist because the FSM guarantees no dead-lock: `interact` releases control to the LLM, and every possible reply (matched intent or off-topic) must have a defined next step.
