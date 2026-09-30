---
"@dot-agent/compiler": minor
---

**`W017` — duplicate `interact` in one state, before any `transition to`.** The kernel's
`exec_entry_statements` (`kernel-dsl/src/engine/fsm.rs`) stops running a state's entry statements as
soon as `current_state` changes, so only `interact` statements preceding the first state-level
transition can both execute and each emit their own `request_interact` effect, with no dedupe at the
host layer (ADR DA00-09).
