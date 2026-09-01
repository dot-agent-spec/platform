---
vibe-ops-template: adr@2
---

# ADR-DA00-10: A Memory Reference Carries Its Own JSON Shape in the AST

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-08-31 |
| Deciders | Danilo Borges |

---

## Context

`Value` is the AST node for an operand — the two sides of a comparison in an `if`, and the right-hand
side of a `set`. It was declared as an untagged enum over `Str(String)`, `Number(f64)`, `Bool(bool)`,
`Null` and `Path(String)`.

`Str` and `Path` have **identical JSON shapes**: both are a bare string. An untagged enum discriminates
by shape alone, so serde could never select `Path`. The variant was unconstructible, and had been since
it was written — the runtime's match arm for it was dead code.

The loss happened one layer earlier. The grammar draws the distinction cleanly: a literal is
`with_quotes_string`, a reference is `state_name`. The CST→AST mapping collapsed both into the same bare
string, so by the time serde saw the JSON there was nothing left to discriminate on. The grammar knew;
the wire format could not say.

Downstream, the runtime resolves an operand by matching on `Value`. Receiving `Str("session.count")`
where it should have received a reference, it returned the **path text** as a string instead of reading
the store. Five behaviors were wrong as a result, and they are one defect, not five:

| Written | What ran |
|---|---|
| `if context.onboarding == true` | string vs boolean — always false |
| `if session.count > 3` | string vs number — always false |
| `if context.name == "danilo"` | path text vs literal — always false |
| `if context.flag` | a non-empty string is truthy — always true, even for a stored `false` |
| `set context.a = session.b` | wrote the literal text `"session.b"`, and shipped it as an effect |

The fourth row is the workaround the field report recommended for the first. It was broken in the
opposite direction.

DA00-06 designates the AST as the formal single source of truth for the JSON contract, with the
TypeScript types generated from it. Changing that contract is therefore a decision, not an
implementation detail — which is why it is recorded here.

## Decision

We will give a memory reference **its own JSON shape**: `Path` becomes a struct variant serializing as
`{"path": "…"}`, and the CST→AST mapping tags an unquoted operand as it maps it. `Value` becomes:

```typescript
type Value = string | number | boolean | null | { path: string }
```

The tagging is **positional**. It happens inside the grammar's `value` wrapper, which appears only
inside an expression, and an expression appears only as a `set` right-hand side or inside a condition.
The same grammar node also names a state declaration and a `transition to` target; neither passes
through a `value` node, so both keep deserializing as plain strings.

```mermaid
flowchart LR
    A["unquoted operand<br/>context.flag"] --> B{inside a<br/>value node?}
    C["state declaration<br/>transition target"] --> B
    B -- yes --> D["Path { path }<br/>read from memory"]
    B -- no --> E["plain String<br/>a name, unchanged"]
    F["quoted literal<br/>&quot;danilo&quot;"] --> G["Str<br/>never resolved"]
```

The grammar is not touched.

## Options considered

- **Option A — Reorder the variants, putting `Path` before `Str`.** The obvious move, and impossible:
  both variants hold a `String`, so an untagged enum sees one shape and declaration order decides
  nothing about which *should* win. If it did decide, it would invert the defect — every quoted literal
  would become a memory lookup. Rejected.
- **Option B — Keep the AST lossy and let the runtime guess.** Treat any string containing a dot as a
  reference. Rejected: it makes `"context.foo"` unwritable as a literal, and it pushes syntax knowledge
  into a layer that never sees the syntax tree.
- **Option C — Add a distinct node to the grammar.** It would work, but it regenerates the parser and
  drags in the container-based WASM build for a distinction the grammar **already draws**. The loss is
  entirely in the CST→AST mapping, so that is where it should be repaired. Rejected as
  disproportionate.
- **Option D (chosen) — A struct variant, tagged positionally during the CST→AST mapping.** The object
  shape is unambiguous against every sibling, so variant order stops mattering; the grammar stays
  frozen; and the AST stays pure data, with the decision about *which* operand is a reference made in
  the mapping layer where the tree is still available. The cost is a changed wire contract.

## Consequences

**Easier.** Conditions and `set` now read memory, which is what the language always documented. The
runtime's resolution arm stops being dead code. A reader of the JSON can tell a literal from a
reference without re-deriving it from the source text.

**Harder — this is a breaking wire-contract change.** Any consumer that pattern-matches a condition
operand as a plain string breaks. Nothing in this repository does: the compiler walks only the branch
bodies and never reads a condition, and the language server carries hover text only. The repository
cannot speak for consumers outside it. The generated TypeScript type follows automatically from the
Rust, which means **nobody sees it change in review** — the hand-written contract document is the only
place a reviewer meets it, so that edit is load-bearing rather than cosmetic.

**A silent correction, not a regression.** A behavior written against the old runtime had its truthy
checks firing unconditionally; they now evaluate honestly, and a flow that always took the `then`
branch may now always take the `else` branch. No diagnostic fires. This is the most likely source of a
downstream report, and it is the bug being fixed rather than a new one.

**An unqualified bare word resolves to nothing, and on a `set` that is an observable break.** An
operand with no domain prefix is now a reference whose lookup fails, yielding null. The two operand
positions part company here, and only one of them is safe:

| Position | Before | After |
|---|---|---|
| Condition — `if mode == active` | false: path text vs bare word, never equal | false: null vs null on the left, null on the right |
| `set` right-hand side — `set context.stage = planning` | stored `Str("planning")` | stores `Null` |

Both rows are measured, on this branch and on the commit before it. The condition does not move — what
moves is the *reason*, and the earlier proposal that a bare word "happens to work today" did not
survive measurement. The `set` **does** move: a behavior that used a bare word as a string literal now
writes null, and the `Effect::SetMemory` shipped to every SDK host carries that null. No diagnostic
fires. Quoting the word restores the literal, and that is the migration.

Accepting the break rather than special-casing it is deliberate. A fallback to "if it has no domain,
treat it as a string" is Option B above, narrowed: it puts the meaning of an operand back in the hands
of whether the text happens to contain a dot, which is the ambiguity this record exists to remove. The
in-tree corpus is safe — the only `set` statements in any tracked `.behavior` file are
`dogfood/new-adr/adr-author.behavior`'s `= true` and `= false`, which the grammar reads as boolean
literals rather than bare words, and there is no `if` in the corpus at all. Both facts are pinned by
kernel tests, so nothing here regresses.

**The disjoint-shape invariant is now load-bearing.** This works because `{"path": …}` is the only
object-shaped variant of `Value`. Adding a second object-shaped variant reintroduces exactly the
shadowing this record exists to remove. Anyone extending `Value` is holding that invariant.

**Follow-up, deliberately not taken here.** A lint that flags an unquoted operand with no memory
domain is the only thing that would make the `set` break above visible instead of silent: it would fire
on `set context.stage = planning` and say "quote it, or give it a domain". It belongs to the compiler
and needs its own diagnostic code, so it is out of scope for this change — but it is the mitigation
this record is accepting the absence of, not a nice-to-have, and it should be carried as a tracked
issue rather than as this paragraph.

## Related

- DA00-06 — the AST as the single source of truth for the JSON contract, which makes this a recorded
  decision rather than a quiet commit.
- [DA00-11](DA00-11-null-equality-answers-whether-a-path-is-set.md) — makes `== null` and `!= null`
  answer whether a path is set. Forced by this decision: an unresolvable reference now resolves to
  null, so an author needs a way to ask about it.
