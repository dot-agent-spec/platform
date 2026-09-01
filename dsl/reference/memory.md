# Memory Domains

`.behavior` tracks state across four semantic scopes with distinct lifetimes. Memory is owned by the Runtime — the kernel holds a read-only view used only for `if` condition evaluation.

---

## Domains

| Domain | Lifetime | Use |
|---|---|---|
| `context` | Current LLM turn | Active working memory for the model. Cleared after each turn. |
| `session` | Current conversation thread | Cross-turn conversation state. Cleared when the thread closes. |
| `worksession` | Current work unit | Task-scoped data. Cleared when the work unit ends. |
| `user` | Long-term, persistent | User preferences and history. Persists across all conversations. |

---

## `set` — Writing to Memory

```
set context.active_phase   = "planning"   // cleared after this turn
set session.has_context    = true         // cleared when thread closes
set worksession.phase      = "review"     // cleared when work unit ends
set user.language          = "pt-br"      // persists across all conversations
```

**Operator forms:**

| Operator | Semantics |
|---|---|
| `=` | Assign value |
| `+=` | Increment (numeric) or append (string/array) |
| `-=` | Decrement (numeric) |

**Unqualified variables** (no domain prefix) are specified as local to the current state and not
persisted:
```
set localVar = true
```
⚠️ **Not implemented.** The grammar accepts the form, but the AST requires a domain, so an unqualified
`set` is rejected while mapping with `missing field domain`. Give every `set` a domain until this is
built. (Measured 2026-08-31, unrelated to and untouched by ADR DA00-10.)

---

## Reading from Memory

Memory values are read in `if` conditions:

```
if session.plan_ready == true
  transition to review
else
  transition to planning
end
```

**Supported comparison operators:** `==`, `!=`, `>`, `<`, `>=`, `<=`
**Supported logical operators:** `and`, `or`

### Reference or literal — quoting decides

Every operand of a condition, and the right-hand side of a `set`, is one of two things:

| Written | Meaning |
|---|---|
| `session.plan_ready` | a **reference** — read the value stored at that path |
| `"planning"` | a **literal** — the text between the quotes |
| `42`, `true`, `null` | a **literal** of that type |

So a `set` copies between paths, and the value that lands is the one that was stored:

```
set context.city = session.city
```

A reference reads as its stored type. `if session.count > 3` compares numbers when `session.count`
holds a number; `if context.onboarding` is true only when the stored value is itself truthy.

**A reference is null when it cannot be resolved** — an unset path, and equally an operand with no
domain prefix, since a lookup needs `<domain>.<key>`. Nothing is raised. What each comparison then does,
with `context.missing` never written:

| Written | Result |
|---|---|
| `if context.missing == null` | **true** — this is how a behavior asks whether a path is set |
| `if context.missing != null` | false — and true for a path that *is* set |
| `if context.missing == "x"` | false |
| `if context.missing != "x"` | **true** — an unset path is not `"x"` |
| `if context.missing > 3` | false — an ordering comparison against null is always false |
| `if context.missing` | false — null is not truthy |

A stored null is the same thing as an unset path here: `set context.x = null` makes
`if context.x == null` true. The language does not distinguish "holds nothing" from "was never written".

**An operand with no domain is a reference too, so it resolves to null** — it is not a bare string:

```
set context.stage = planning       # writes null: `planning` has no domain to read from
set context.stage = "planning"     # writes the text: quoting makes it a literal
```

Always give an operand a domain when a condition has to see it, and quote what you mean literally.

---

## Memory ownership model

The Runtime owns the canonical memory store. Flow on every `set` effect:

```
kernel emits: SetMemory { domain: "session", key: "city", value: "São Paulo" }
  → SDK dispatches to Runtime's SetMemory handler
  → Runtime stores value canonically
  → Runtime applies permission check
  → Runtime calls kernel.inject_memory("session", "city", "São Paulo")
  → kernel updates its read-only view (used for `if` evaluation only)
```

This means `.behavior` files never directly write to persistent storage — every `set` is mediated by the Runtime.

---

## Runtime-managed variables (read-only)

These variables are set by the Runtime and available for reading in `if` conditions:

| Variable | Type | Description |
|---|---|---|
| `session.is_first_time` | boolean | `true` on the user's first conversation with this agent |
| `session.prompt_count` | number | Number of LLM turns in the current session |
