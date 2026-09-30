---
"@dot-agent/sdk": minor
---

`session.restore(snapshot, options?)` rehydrates a fresh `AgentSession` in place of `start()`, with the same `resolveContent` option: it loads the behavior, discards the `init` entry effects so no handler or listener sees them, clears the memory that load wrote (with the kernel's new `clear_memory()`), repositions the FSM and writes the snapshot's memory back — so the restored memory is exactly the snapshot's, every value's type and content intact, and memory injected before a successful restore is replaced. A snapshot from a different agent or behavior revision, a malformed one, one of an unknown version, or a behavior that fails to parse throws and leaves the session unstarted, its injected memory and file resolver in place, and usable for `start()` (#17).
