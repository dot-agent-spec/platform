# @dot-agent/sdk

## 0.12.0-alpha.0

### Minor Changes

- b340f27: `session.snapshot()` returns an opaque, JSON-serialisable `AgentSnapshot` — the kernel's FSM position (state and prompt count) plus the whole memory store, with its own format version and the agent's id (#17).
- b340f27: `session.restore(snapshot, options?)` rehydrates a fresh `AgentSession` in place of `start()`, with the same `resolveContent` option: it loads the behavior, discards the `init` entry effects so no handler or listener sees them, clears the memory that load wrote (with the kernel's new `clear_memory()`), repositions the FSM and writes the snapshot's memory back — so the restored memory is exactly the snapshot's, every value's type and content intact, and memory injected before a successful restore is replaced. A snapshot from a different agent or behavior revision, a malformed one, one of an unknown version, or a behavior that fails to parse throws and leaves the session unstarted, its injected memory and file resolver in place, and usable for `start()` (#17).
- b340f27: `AgentSnapshot` and `StartOptions` types are exported.
- b340f27: `start()` now throws on a session that was restored from a snapshot, and `restore()` throws on a session already started or restored. `snapshot()` throws before either, and after a `start()` whose behavior failed to parse (`start()` itself still reports that as a `parse_error` effect).

### Patch Changes

- Updated dependencies [b340f27]
- Updated dependencies [b340f27]
- Updated dependencies [b340f27]
- Updated dependencies [b340f27]
- Updated dependencies [b340f27]
- Updated dependencies [b340f27]
- Updated dependencies [b340f27]
- Updated dependencies [b340f27]
- Updated dependencies [b340f27]
- Updated dependencies [b340f27]
- Updated dependencies [b340f27]
- Updated dependencies [b340f27]
- Updated dependencies [b340f27]
  - @dot-agent/compiler@0.12.0-alpha.0
  - @dot-agent/kernel-dsl@0.12.0-alpha.0

## 0.10.3 and earlier

Releases up to 0.10.3 were recorded by hand, in Keep a Changelog format, before this package moved to changesets. That history is kept in git: [CHANGELOG.md at 73b975b](https://github.com/dot-agent-spec/platform/blob/73b975bc1f4e88a18f47f89b711c8b5207b05e6c/packages/sdk/CHANGELOG.md).
