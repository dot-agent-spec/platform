<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0019: Memory Binding

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-23 |
| Author | Danilo Borges |
| Related | [RFC-0004](0004-kernel-protocol.md) — memory ownership model; [RFC-0014](0014-data-contract.md) — intent data contracts and `with TypeName` |

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| ⚠️ | ⚠️ | ⚠️ | ⚠️ | ? |

---

## Summary

This RFC proposes two complementary mechanisms for connecting memory to the flow of data in `.behavior` files. The first, `extract`, allows a behavior to bind fields produced by the LLM in the current turn into a named memory variable — closing the gap where `set` only accepts literal values and there is no way to capture what the LLM just extracted from the user. The second extends the `run` statement to accept memory variable references in its parameter payload, so that session and context variables accumulated during a conversation can be passed directly to scripts, tools, and subagents without requiring those components to read memory through a side-channel Runtime API. Together these two features form a coherent memory-binding surface: `extract` writes LLM-derived values into memory, and interpolated `run` parameters read those values back out when executing external code.

---

## Motivation

During the dogfood pass that modeled the `/new-rfc` skill as a `.behavior` state machine (see `dogfood/EXPRESSIVENESS.md`), two related gaps surfaced back-to-back:

**G1 — No way to capture user input into session memory.** The `collect_topic` state used an oriented loop to ask the user for an RFC topic and author name. Once the LLM extracted those values from the user turn, there was no statement to write them into session memory. The `set` statement accepts only literals (`set session.topic = "hardcoded"`), not references to values the LLM just produced. The workaround — a boolean flag (`set session.topic_collected = true`) — was added and then removed because it carried no real information. The downstream script had no way to receive the collected values except through a Runtime side-channel that `.behavior` cannot express.

**G4 — No string interpolation in `run` parameter payload.** Even if session variables were populated (e.g. through G1), `run script "scaffold-rfc.js" "session.topic"` passes the literal string `"session.topic"` as the parameter, not the resolved value. Scripts called from setup states cannot receive dynamic session data through the `run` statement. The workaround was to call scripts with no parameters at all, pushing the burden of memory access entirely into the script's own Runtime API calls.

These two gaps compound: G1 makes it impossible to write LLM-extracted values into memory, and G4 makes it impossible to forward those values to scripts even if they were written. The combined effect is that the `.behavior` layer is effectively disconnected from the data the LLM collects during conversation — a fundamental expressiveness gap for any workflow that hands off collected data to an execution step.

---

## Specification

### G1 — `extract`: bind LLM-extracted values into memory

The `extract` statement binds a named field from the LLM's most recent turn output into a memory variable. It is valid only inside `on intent` block handlers (oriented states), immediately after the runtime has completed an LLM turn.

**Syntax:**

```
extract <memory-variable> from intent
```

Where `<memory-variable>` is a qualified memory path in any writable domain (`context.*`, `session.*`, `worksession.*`, `user.*`) or an unqualified local variable.

**Example — collect RFC topic in a workflow:**

```
state collect_topic
  goal "Collect the RFC topic and author name from the user"
  guide "Ask for: a short topic phrase and the author's name."
  interact
  on intent "topic provided"
    extract session.topic from intent
    extract session.author from intent
    transition to draft_sections
  on offtopic transition to collect_topic
```

The Runtime resolves each `extract` by calling the LLM with a structured extraction prompt that identifies the named field from the intent turn. The extracted value is stored in the memory domain using the same `SetMemory` effect path that `set` uses, so the memory ownership model from RFC-0004 is preserved: the kernel emits `ExtractMemory { field: "topic", domain: "session", key: "topic" }`, the SDK dispatches it to the Runtime, and the Runtime stores the value and calls `kernel.inject_memory` to update the kernel's read-only view.

**Field name resolution:** the identifier after `extract` and before `from intent` is the memory variable path. The field name the Runtime presents to the LLM for extraction is derived from the final key segment (e.g. `session.topic` → field name `"topic"`; `session.author` → `"author"`). An explicit alias form is left as an open question (see Open Questions).

**Relationship to RFC-0014 `with TypeName`:** RFC-0014 introduces `on intent "x" with TypeName`, which validates that the LLM turn carries a complete, well-typed data object before allowing a transition. `extract` and `with TypeName` are complementary, not competing:

- `with TypeName` is a structured, all-or-nothing validation gate: the intent transition is blocked until all fields of `TypeName` are present and typed correctly. The Runtime uses `strict: true` tool calling and injects a correction prompt on failure. The data contract is expressed as a named type defined elsewhere.
- `extract` is a lightweight, field-by-field binding: it captures individual scalar values (strings, numbers, booleans) from the LLM's natural response without requiring a formal type declaration. It does not block the transition; it runs as a side-effect before `transition to`.

A behavior can use both in the same handler when appropriate:

```
on intent "topic provided" with RfcTopicInput
  extract session.topic from intent
  extract session.author from intent
  transition to draft_sections
```

Here `with RfcTopicInput` validates the full contract and `extract` additionally stores individual fields for downstream use. Whether the two should be allowed together, and whether `extract` should be permitted to redundantly bind fields already validated by `with`, is left as an open question.

---

### G4 — Memory interpolation in `run` parameters

The `run` statement's optional parameter string is extended to support memory variable references using `{variable}` interpolation syntax. At runtime the kernel resolves each `{...}` reference to the current value of that memory variable before dispatching the `RunScript` / `RunTool` / `RunSubagent` effect.

**Syntax:**

```
run script "<file>" "{session.variable}" "{context.variable}"
run tool   "<name>" "{session.variable}"
run subagent "<file>" "{session.variable}"
```

Memory variable references are enclosed in curly braces `{}` inside a quoted parameter string. A parameter string may contain only a reference (as above), or may mix literal text with one or more references:

```
run script "scaffold-rfc.js" "--topic={session.topic} --author={session.author}"
```

**Example — pass collected topic to scaffold script:**

```
state draft_sections
  run script "scripts/scaffold-rfc.js" "--topic={session.topic} --author={session.author}" on failure
    transition to error
  transition to validate_impact_table
```

**Resolution semantics:** the kernel reads the memory variable from its injected view at the moment the `run` statement executes. If a referenced variable is unset (no value has been stored for that key), the kernel substitutes an empty string and emits a warning effect. Whether an unset variable should instead block execution (hard error) is left as an open question.

**Escaping:** a literal `{` in a parameter string is written as `\{`.

---

## Rationale

**`extract ... from intent` vs. alternatives:**

- *`set session.topic = intent.topic` (property access syntax)* — this implies the kernel can directly dereference a structured object called `intent` at compile time, which would require the LLM's output to be a typed object. That is the RFC-0014 model. `extract` deliberately avoids imposing a type: the field name is a hint to the Runtime for a lightweight extraction, not a schema reference.
- *Automatic population by the Runtime* — the Runtime could automatically populate `session.*` from named slots the LLM identifies, without any `extract` statement. This would be invisible to the behavior author and hard to audit. Making extraction explicit keeps the behavior file as the authoritative description of what memory is written and when.
- *`set session.topic = $intent.topic` (dollar-prefix reference)* — a plausible alternative syntax, but introduces a new sigil (`$`) that has no other role in the language. The `from intent` phrasing reads naturally as English ("extract the topic from the intent turn") and avoids a new sigil.

**`{variable}` interpolation vs. alternatives:**

- *Bare variable reference: `run script "x" session.topic`* — dropping the quotes and braces is the sketch from `dogfood/EXPRESSIVENESS.md` (`run script "scaffold-rfc.js" session.topic`). It is concise but ambiguous: the parser cannot distinguish a memory reference from a string literal without lookahead, and it makes mixed literal+reference strings impossible.
- *Template string: `run script "x" f"--topic={session.topic}"`* — a dedicated template string prefix (`f"..."`) is common in other languages but adds a new token type to the lexer for a narrow use case.
- *`{variable}` inside a regular quoted string* — chosen because it is familiar (shell, JavaScript template literals, Python f-strings all use `{}`), requires no new token type (the grammar detects `{...}` patterns inside string literals during parse), and makes mixed literal+reference strings natural.

**sdk is `?`:** the impact depends on an unresolved design choice. If `extract` reuses the existing `SetMemory` effect (the Runtime performs the extraction and writes through the established path), the change is transparent to the SDK (`—`). If `extract` instead introduces a new `ExtractMemory` effect, the SDK's dispatch layer must learn to route it (`⚠️`). The interpolation half (G4) is always SDK-transparent — it resolves inside the kernel before the `Run*` effect is dispatched. See Open Questions.

---

## Implementation Notes

- `tree-sitter`: add `extract_stmt` rule (`extract <mem_path> from intent`) to `grammar.js`. Add `{` / `}` interpolation pattern recognition inside `run_stmt` parameter strings.
- `parser-dsl`: extend `BehaviorFile` AST with `ExtractStmt { target: MemPath }` node inside `IntentBlock`. Extend `RunStmt` parameter representation to carry a `ParameterExpr` (sequence of literal segments and `MemRef` segments) instead of a plain string.
- `compiler`: validate that `extract` only appears inside `on intent` block handlers, not in setup states or top-level `on event` blocks. Validate that `{variable}` references in `run` parameters refer to valid memory paths (domain + key form). Emit a warning diagnostic for references to variables that are never written in the same file.
- `kernel-dsl`: implement `ExtractMemory` effect emission for `extract` statements, calling the Runtime's extraction interface. Implement interpolation resolution for `run` parameter strings: read each `MemRef` from the injected memory view, substitute, and pass the resolved string in the effect.
- Cross-reference RFC-0004 for the `inject_memory` / `SetMemory` flow that `extract` piggybacks on.

---

## Open Questions

1. **Explicit field alias for `extract`.** The current proposal derives the field name from the final key segment of the memory path (`session.author` → field `"author"`). Is this always unambiguous? Consider `session.rfc_author_name` → field `"rfc_author_name"`. An explicit alias form (`extract session.author as "Author Name" from intent`) may be needed for clearer LLM extraction prompts.

2. **`extract` and `with TypeName` in the same handler.** Should a behavior be allowed to use both `on intent "x" with TypeName` and `extract` in the same block? If the `with` contract already validates and structures the data, `extract` may be redundant for fields already in the type. If allowed, which takes precedence when a field exists in the type but is also named in `extract`?

3. **Unset variable in `{...}` interpolation.** If `{session.topic}` is referenced in a `run` parameter but `session.topic` has never been set, should the kernel (a) substitute an empty string and emit a warning, (b) block execution and emit a hard error, or (c) pass through the literal `{session.topic}` string? Option (b) is safest but may break workflows that conditionally populate variables.

4. **Interpolation in non-`run` positions.** Should `{variable}` interpolation be limited to `run` parameter strings, or should it also be available in `guide "..."`, `teach "..."`, and `goal "..."` strings? This RFC proposes limiting it to `run` for now; other positions would require a separate RFC.

5. **`extract` in `on event` handlers.** The current proposal restricts `extract` to `on intent` blocks. Is there a use case for `extract` in top-level `on event` handlers (e.g., extracting data from an event payload)? If so, the `from intent` source should be generalized to `from event` or `from <source>`.

6. **Boundary with RFC-0014.** RFC-0014's `with TypeName` is a blocking gate — the transition does not proceed until the type contract is satisfied. `extract` is non-blocking. Should the RFC explicitly forbid using `extract` as a substitute for `with TypeName` in cases where schema validation is desirable? Or is the choice left entirely to the behavior author?

7. **Does `extract` need a new effect? (determines sdk impact).** If `extract` reuses the existing `SetMemory` effect — the Runtime extracts the value and writes it through the established memory path — the SDK is unchanged (sdk `—`). If `extract` emits a new `ExtractMemory` effect, the SDK must dispatch it (sdk `⚠️`). The impact table marks sdk `?` until this is resolved.

---

## Decisions Closed

---

## Related

- [`dogfood/EXPRESSIVENESS.md`](../dogfood/EXPRESSIVENESS.md) — gaps G1 and G4 that motivated this RFC
- [RFC-0004: Kernel Protocol](0004-kernel-protocol.md) — `inject_memory` / `SetMemory` flow that `extract` builds on
- [RFC-0014: Data Contract](0014-data-contract.md) — `on intent ... with TypeName` structured validation; complement to `extract`
- [`dsl/reference/behavior.md`](../dsl/reference/behavior.md) — current `set` and `run` semantics
- [`dsl/reference/memory.md`](../dsl/reference/memory.md) — memory domain semantics and ownership model
