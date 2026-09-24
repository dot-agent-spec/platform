---
vibe-ops-template: adr@2
---

# ADR-DA00-11: Null Equality Answers Whether a Path Is Set

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-09-01 |
| Deciders | Danilo Borges |

---

## Context

[DA00-10](DA00-10-memory-reference-is-tagged-in-the-ast.md) makes an unquoted operand a memory
reference. A reference that cannot be resolved — an unset path, or an operand with no domain prefix —
resolves to `MemValue::Null`. That moved null from rare to routine: before, an unresolved operand
arrived as the path *text*, so a runtime null only came from a value someone had stored.

`eval_compare` in `packages/kernel-dsl/src/engine/fsm.rs` matches `(Num, Num)`, `(Str, Str)` and
`(Bool, Bool)`, then falls through to a mismatched-pair arm returning `false` for `==` and `true` for
`!=`. That arm also caught `(Null, Null)`, which is not a mismatched pair. Measured on this branch
before the change:

| Written, `context.x` unset | Ran |
|---|---|
| `if context.x == null` | **false** — took the `else` branch |
| `if context.x != null` | **true** — took the `then` branch |

Both are backwards, and they are backwards in the same direction for a path that *is* set. So `null`
did not equal itself, and the language had no way to ask whether a path is set:
`dsl/reference/memory.md` offers an author six comparison operators and no other test.

## Decision

We will compare two nulls as equal. `eval_compare` gains a `(Null, Null)` arm where `==` is true,
`!=` is false, and an ordering comparison (`>`, `<`, `>=`, `<=`) stays false, as it is for every
mismatched pair.

This gives the DSL its unset test with no new syntax:

```
if context.x == null      # the path is not set
if context.x != null      # the path is set
```

Mismatched pairs are untouched: a set path is still `!= null`, and an unset path is still `!= "x"`.

**What this reaches beyond the two forms above.** Making null reflexive makes *every* pair of
unresolvable operands equal, not only the ones written against the `null` literal. Composed with
[DA00-10](DA00-10-memory-reference-is-tagged-in-the-ast.md), under which an operand with no domain
prefix resolves to null, that turns two bare words into a true comparison:

```
if mode == active                    # both unresolvable -> both null -> TRUE
if context.missing == planning       # unset path vs bare word -> TRUE
```

Measured on this branch, and false on the commit before it. This is the larger half of the
consequence and it belongs here, in the record that causes it: DA00-10 alone would have left both
comparisons false. An author who writes `if user.plan == free` meaning a literal now gets a branch
that fires whenever `user.plan` is unset. Quoting is the fix, and
`bare_word_equality_is_null_equality` in `engine/mod.rs` pins the behavior so a later change to
`eval_compare` cannot revert it in silence.

## Options considered

- **Option A — Leave the behavior and document the hole.** Rejected. It records a defect as a
  contract, and equality that is not reflexive is a defect under any reading. DA00-10 makes null the
  common answer, so the hole is now on the path an author walks.
- **Option B — New syntax, `if context.x is set`.** Rejected as disproportionate: new syntax goes
  through an RFC and a grammar change, which regenerates `parser.c` and drags in the container WASM
  build — for a question `== null` already asks. `null` is already a literal the grammar accepts in
  that position.
- **Option C — Make every comparison against null false**, matching the shortest sentence one could
  write in the reference. Rejected: it leaves `!= null` false as well, so there is still no unset
  test, and it needs a special case anyway. Choosing between two special cases, the one that answers
  the author's question wins.
- **Option D (chosen) — One arm in `eval_compare`.** Three lines, no grammar, no new wire shape, and
  the reference document gets a complete truth table instead of a hedge.

## Consequences

**Easier.** An author can test whether a path is set. Equality is reflexive. `dsl/reference/memory.md`
can state what every comparison against null does, and a kernel test pins each row of that table.

**Harder — a behavior that relied on the old `!= null` flips.** Measured: `if context.missing != null`
took the `then` branch before this change and takes the `else` branch after. No diagnostic fires. It
is the same class of silent correction DA00-10 accepts, and for the same reason: the previous answer
was wrong, not merely different.

**Unset and stored-null are the same thing to the language.** `MemoryStore` returns `MemValue::Null`
for a path that was never written, and `set context.x = null` stores exactly that value. Measured:
after `set context.x = null`, `if context.x == null` is true. So `== null` reads as "holds nothing",
never as "was never written". Anything that must tell the two apart needs a stored sentinel of its own.

## Related

- [DA00-10](DA00-10-memory-reference-is-tagged-in-the-ast.md) — makes an unresolvable reference
  resolve to null, which is what put this arm on the author's path.
- [`dsl/reference/memory.md`](../../dsl/reference/memory.md) § Reading from Memory — the truth table
  this decision makes statable.
