---
"@dot-agent/kernel-dsl": minor
---

**`clear_memory()` — empty every memory domain in one call.** `set_memory` can only add or overwrite, so a host rehydrating a session had no way to remove what `load_behavior`'s run of the init entry wrote — a `set` guarded by `if user.name == null`, or one in a state init transitions into on load — and the restored memory held keys the saved session never had. `clear_memory()` empties `context`, `session`, `worksession` and `user`, leaves the FSM where it is, and emits nothing; clearing before re-injecting makes the restored memory exactly the saved one (#17).
