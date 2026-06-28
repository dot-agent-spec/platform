<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

> ⚠️ Point-in-time DSL usability snapshot (2026-06-27). NOT spec truth — may be obsolete. Source of truth: dsl/ + packages/.

# DSL Expressiveness Report — helper.agent (Interactive CLI Guide)

> **Context:** `helper.description` + `helper.behavior` model a 20-state interactive
> navigation guide embedded in the CLI. This document records firsthand experience
> authoring the DSL — what expressed cleanly, every place the language resisted, and
> the exact error messages encountered. Each gap is a candidate RFC or task.

---

## What expressed cleanly

- **Hub-and-spoke navigation.** A central `init` state with `on intent "topic" → subtopic`
  handlers, and `on intent "back" → init` in every leaf, maps naturally to the DSL. The
  structure reads almost like a sitemap. 20 states, no ambiguity.

- **`teach "filename.md"` as a content pointer.** The effect emits the filename; the LLM
  fetches the content via `dot-agent://knowledge/{name}`. This cleanly separates
  navigation logic (in `.behavior`) from rich content (in `knowledge/` files). Once this
  semantic was understood, every `guide` string became short and every deep example lived
  in a file — exactly the right boundary.

- **`on offtopic` as a universal fallback.** Placing `on offtopic → <self>` on every
  state is a repeating one-liner that requires no design decisions. The language makes
  defensive navigation trivially cheap.

- **Inline `on intent "name" transition to state` (single-line form).** For states with
  only one handler, the inline form (`on intent "done" transition to init`) kept the file
  compact. Having both block and inline forms without introducing ambiguity is a good
  affordance.

- **State-level effects before handlers.** The ordering rule — `goal`/`guide`/`teach`/
  `interact` at the top, `on intent` / `on offtopic` handlers below — maps well to the
  "what to emit, then when to move" reading. The grammar enforces this silently;
  experienced authors will internalize it quickly.

---

## Gaps & limitations

### G1 — String character restrictions are undocumented and non-obvious

**Problem:** `guide "..."` and `goal "..."` strings reject a significant subset of printable
ASCII and all Unicode outside the basic Latin range. The restrictions encountered:

- `\n` — escape sequence not supported (E004)
- `{` and `}` — conflict with grammar production
- `#` — treated as comment character inside strings
- `—` (U+2014 em-dash) — E004
- `'` `'` (U+2018/U+2019 curly quotes) — E004
- `\` (backslash) — E004

The safe set is: alphanumeric, space, `. , : ; ( ) ! ? - _ / + = < > [ ] @`.

**Workaround used:** Moved all rich content (code examples, tables, multi-line text) to
`knowledge/` files referenced via `teach`. Guide strings were kept to one plain sentence.

**Impact:** The restriction materially limits what an agent can say without a knowledge
file. A simple `guide "Use set_memory({ key: value })"` (curly braces in example) is
illegal. The author must discover the restriction by trial and error.

**Task candidate:** Document the allowed character set in `dsl/reference/behavior.md`
under `guide` / `goal`. Consider relaxing `{` / `}` by switching the grammar to a
delimiter that does not collide with common prose (e.g., use backtick quoting for the
tree-sitter `string` rule in behavior).

---

### G2 — `teach` semantics are not obvious from the keyword name

**Problem:** `teach "text"` looks like it accepts inline instructional text. The actual
semantic is: emit the literal string `"text"` as the effect payload, which the MCP client
interprets as a filename and fetches via `dot-agent://knowledge/{text}`. The keyword name
implies content delivery; the actual behavior is indirection.

**Workaround used:** Understood the semantic only after reading the MCP resource spec and
observing that inline attempts like `teach "Here is an example:\nfoo()"` produced E004
on the `\n`.

**RFC candidate:** Consider renaming `teach` to `refer` or `cite`, which implies reference
to an external file rather than inline content delivery. Alternatively, add a `teach` +
inline block form for short content and reserve filename semantics for `teach file "name"`.

---

### G3 — No way to enumerate the current state's available intents at runtime

**Problem:** Every state with navigation choices includes a `guide` string that manually
lists the available intents: `"Topics: about, dsl, mcp, generate, example"`. If states
are added or removed, these strings must be updated by hand.

There is no `guide intents` effect that would emit the current state's declared intent
names automatically.

**Workaround used:** Maintained the guide strings manually. For 20 states this was
error-prone (the `init` state guide listed 5 topics but the behavior had 6 `on intent`
handlers at one point).

**RFC candidate:** A `guide intents` built-in effect that emits a formatted list of
`on intent` handler names for the current state. The kernel already has this information
at dispatch time.

---

### G4 — No way to pass "which state I came from" to the destination

**Problem:** Several states in a navigation tree want to say "you were just in DSL →
Description; here are related topics." The only way to express this is to create separate
destination states for each entry path (e.g., `dsl_behavior_from_description` vs.
`dsl_behavior_from_states`). That explodes the state count.

**Workaround used:** All transitions to shared states are unconditional. The guide text
in each state is generic ("Related: description, states, effects") rather than
context-aware.

**RFC candidate:** This falls into the same category as G1 in `rfc-author/` (input
extraction) — the behavior needs session context that only the kernel can populate at
transition time. A `set session.from = <current_state>` automatic effect on `transition`
would let downstream states read `session.from` and branch. This pairs with the existing
RFC candidate on session memory binding.

---

### G5 — `goal` vs `guide` distinction is not authoritatively documented for navigation agents

**Problem:** Both `goal` and `guide` emit text to the LLM. The W012 warning ("goal is
only valid in an oriented state") revealed a distinction: `goal` is for states with
`interact`; `guide` is for setup/navigation states. The `init` state in this agent had
`goal "Topics: ..."` which triggered W012 because `init` has no `interact`.

The linter caught this correctly. The confusion was that the reference documentation
describes `goal` and `guide` as both "emit text" effects, without clearly stating the
oriented vs. non-oriented constraint.

**Workaround used:** Changed `goal` to `guide` in `init` after the W012 warning.

**Task candidate:** Add a clear rule to `dsl/reference/behavior.md`: "`goal` is only
valid in states that contain `interact`. For states without `interact`, use `guide`."
The current reference describes the effects but not this constraint.

---

## Parser & linter error-message quality

---

### D1 — E004 on DSL keywords vs. Rust-enum names: no "did you mean" hint

**What was emitted:**
```
E004: Syntax error near 'transition_to'
E004: Syntax error near 'request_interact'
E004: Syntax error near 'on intent about'
```

**What was wrong:** The first version of `helper.behavior` used:
- `transition_to state` — the Rust kernel enum variant name, not the DSL keyword
- `request_interact` — the Rust effect type name, not the DSL keyword
- `on intent about` — bareword intent name, missing required double quotes

The correct forms are `transition to state`, `interact`, and `on intent "about"`.

**Why the messages were unhelpful:** All three produced identical `E004: Syntax error near
'X'` messages. None offered the correct keyword. The root cause was that the DA documents
the kernel's Rust representation (enum names) in the spec's effect tables, and a reader
infers those are the DSL keywords. They are not.

**What would have been actionable:**
```
E004 (line 12): 'transition_to' is not a valid keyword. Did you mean 'transition to <state>'?
E004 (line 18): 'request_interact' is not a valid keyword. Did you mean 'interact'?
E004 (line 5): Intent name must be quoted: 'on intent "about"', not 'on intent about'
```

The grammar knows exactly which token was unexpected and what was expected at that
position. Mapping a small set of common wrong-form tokens to right-form hints is a
targeted linter addition (not a grammar change).

**Pattern:** The divergence between DA spec language (Rust enum names) and DSL author
language (behavior keywords) is the deepest authoring hazard in the current toolchain.
A "common mistakes" section in `dsl/reference/behavior.md` that cross-references Rust
enum names to DSL keywords would eliminate most of these errors before they hit the linter.

---

### D1b — CLI EISDIR when directory name ends with `.agent`

**What happened:** Trying to `dot-agent run dogfood/helper.agent` (the dogfood directory
itself) produced `EISDIR: illegal operation on a directory, read` with no meaningful
error message — just the Node.js exception.

**Root cause:** `run.ts` used `source.endsWith('.agent')` to decide whether to call
`readFile(source)` (packed bundle) or `bundleFromDir(source)` (directory). A directory
named `helper.agent` matches the extension check and triggers `readFile` on a directory.

**Fix applied:** Replaced the extension check with `stat(source).isFile()` so the
decision is based on filesystem type, not filename.

**Task candidate:** Add a regression test: `dot-agent run <dir-ending-in-.agent>` should
produce the same result as `dot-agent run <dir>`. The extension-based branch is a latent
bug for any agent project directory whose name happens to end in `.agent`.

---

### D2 — E004 on inline text in `teach` with no hint about file-reference semantics

**What was emitted:**
```
E004: Syntax error near 'Here is an example:\nfoo...'
```

**What was wrong:** `teach "inline text with \n"` — treating `teach` as inline content.

**Why the message was unhelpful:** The error names the token it found (the string content
after the `\n`) but gives no indication that `teach` requires a filename, not content.

**What would have been actionable:**
```
E004 (line 34): 'teach' requires a filename (e.g. teach "guide-name.md").
  To include inline content, use 'guide "..."' for short text or create a knowledge file.
```

---

### D3 — W012 message mentions "prettifier" — tool not available to CLI authors

**What was emitted:**
```
⚠ agent.behavior:1:7 W012 'goal' is only valid in an oriented state.
  Add 'interact' or remove 'goal' — the prettifier can adjust this.
```

**What was wrong:** `goal` used in `init` which has no `interact`.

**The message was mostly clear** and actionable (change `goal` to `guide` or add
`interact`). One issue: "the prettifier can adjust this" references a tool not available
in the CLI. CLI authors have no access to a prettifier; the suggestion is noise.

**What would have been cleaner:**
```
W012 (line 1): 'goal' is only valid in an oriented state (one that contains 'interact').
  Use 'guide' here, or add 'interact' if this state should wait for user input.
```
