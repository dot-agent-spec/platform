# @dot-agent/kernel-dsl

## 0.12.0-alpha.0

### Minor Changes

- b340f27: **`serialize_state()` / `restore_state(state_json)` — the FSM position is now persistable.** A host could already persist memory through `get_memory` / `set_memory`, but nothing exposed where the FSM stood, so a runtime could not evict the kernel and resume. `serialize_state()` returns a compact versioned blob (`{"v":1,"behavior":"3d9c…","state":"booking","prompt_count":3}`) and `restore_state()` repositions the FSM from it **without firing entry effects**. The prompt counter travels with the state name because `after N prompts` handlers fire off it and a transition zeroes it — restoring the name alone would fire those handlers a turn late. The blob **excludes memory** by design; that half stays the runtime's, through the existing pair. `restore_state` throws (rather than returning a value a caller can ignore) when the blob is malformed, carries an unreadable version, was taken from a different behavior, names a state the loaded behavior does not declare, or when no behavior has been loaded; it validates before writing, so a rejected restore leaves the kernel untouched.
- b340f27: **The blob carries the behavior's identity, not just its shape.** `v` changes only when this crate changes, so on its own it would admit any blob whose state name happens to exist in the loaded FSM — one agent's position restoring into another that reuses the name, and (since `init` is mandatory and `ended` native) a position at either of those two restoring into literally any agent. `behavior` is a 16-hex-digit fingerprint of the loaded state graph — state names in declaration order, each state's intents and their transition targets, its offtopic handler, its `after N` thresholds — so a foreign or stale blob is refused with an error naming the mismatch. It fingerprints the _graph_, not the source text, so reformatting or a comment does not invalidate stored snapshots.
- b340f27: **Resuming has a required order, and it emits effects the host must discard.** `restore_state` needs a loaded behavior, and `load_behavior` enters `init` and emits its entry effects — for a state the resumed session already left. The sequence is `load_behavior` → **drop the effects it returns** → `clear_memory` → `restore_state` → `set_memory` → `send_intent`.
- b340f27: **`clear_memory()` — empty every memory domain in one call.** `set_memory` can only add or overwrite, so a host rehydrating a session had no way to remove what `load_behavior`'s run of the init entry wrote — a `set` guarded by `if user.name == null`, or one in a state init transitions into on load — and the restored memory held keys the saved session never had. `clear_memory()` empties `context`, `session`, `worksession` and `user`, leaves the FSM where it is, and emits nothing; clearing before re-injecting makes the restored memory exactly the saved one (#17).
- b340f27: **BREAKING — an unquoted operand with no domain resolves to null.** A lookup needs
  `<domain>.<key>`, so `set context.stage = planning` now stores null where it stored the text
  `"planning"`. Quote it — `set context.stage = "planning"` — to keep the literal.
- b340f27: **BREAKING — a comparison between two unresolvable operands is now true.** This is the two changes
  above composed: an unquoted word with no domain resolves to null, and null now equals itself, so
  `if mode == active` and `if context.missing == planning` take the `then` branch where they took
  `else`. The shape to audit is a bare word written meaning a literal — `if user.plan == free` now
  fires whenever `user.plan` is unset, which is the opposite of the intent. Quoting the word restores
  the old result. No diagnostic fires for either half.
- b340f27: **`tick_prompt` saturates instead of overflowing.** The prompt counter is now restorable from host storage, so any `u32` can reach it. At `u32::MAX` the old `+= 1` aborted the module in debug (the workspace builds with `panic = "abort"`, so a host could not catch it) and wrapped to `0` in release, silently re-arming every `after N prompts` handler in the state. A saturated counter now sticks and fires nothing.

### Patch Changes

- b340f27: **Conditions and `set` read memory.** An unquoted operand used to reach the kernel as the path
  _text_, so it was compared as a string: `if context.onboarding == true` was always false,
  `if session.count > 3` was always false, a bare `if context.flag` was always true even for a stored
  `false`, and `set context.a = session.b` stored the literal text `"session.b"` and shipped it to the
  host as an `Effect::SetMemory`. Each now resolves against `MemoryStore`. **This corrects behavior
  silently**: a flow that always took the `then` branch may now always take the `else` branch, with no
  diagnostic. Requires `@dot-agent/parser-dsl` with the tagged `Value` contract (ADR DA00-10).
- b340f27: **`== null` and `!= null` answer whether a path is set.** Two nulls compared as unequal, so
  `if context.x == null` could never be true and `if context.x != null` was true for an unset path —
  both backwards. A behavior that relied on the old `!= null` flips. See ADR DA00-11.

## 0.10.3 and earlier

Releases up to 0.10.3 were recorded by hand, in Keep a Changelog format, before this package moved to changesets. That history is kept in git: [CHANGELOG.md at 73b975b](https://github.com/dot-agent-spec/platform/blob/73b975bc1f4e88a18f47f89b711c8b5207b05e6c/packages/kernel-dsl/CHANGELOG.md).
