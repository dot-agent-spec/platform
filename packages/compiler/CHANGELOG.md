# @dot-agent/compiler

## 0.12.0-beta.1

### Minor Changes

- b340f27: **`W018` — unreachable entry statement after a state-level `transition to`.** A state's entry
  statements stop running as soon as it leaves for another state, so anything after that transition is
  skipped, like code after a `return`. Handlers, a transition to the state itself and a transition inside
  `if` cut nothing.
- b340f27: **`W017` — duplicate `interact` in one state, before any `transition to`.** The kernel's
  `exec_entry_statements` (`kernel-dsl/src/engine/fsm.rs`) stops running a state's entry statements as
  soon as `current_state` changes, so only `interact` statements preceding the first state-level
  transition can both execute and each emit their own `request_interact` effect, with no dedupe at the
  host layer (ADR DA00-09).
- b340f27: **Breaking: `W016` is now `E022` and blocks `pack()`.** A `guide`/`teach` reference resolving outside `guides/`/`knowledge/` used to warn and still bundle the file; `pack` now refuses before writing the archive, naming the file, the reference and the namespace it must move to. Resolves [platform#9](https://github.com/dot-agent-spec/platform/issues/9).
- b340f27: **`W012` generalized to `guide`/`teach`, not just `goal`.** Per ADR DA00-09, an Oriented State (one with
  `interact`) is the only state allowed to carry `goal`, `guide`, or `teach`; a Setup State (no `interact`)
  must carry none of them. `W012` previously checked only `goal`; it now fires for any of the three found
  without `interact` in the same state, and its message lists which ones are present.

### Patch Changes

- Updated dependencies [b340f27]
  - @dot-agent/parser-dsl@0.12.0-beta.1
  - @dot-agent/tree-sitter@0.12.0-beta.1

## 0.12.0-alpha.0

### Minor Changes

- b340f27: **`W018` — unreachable entry statement after a state-level `transition to`.** A state's entry
  statements stop running as soon as it leaves for another state, so anything after that transition is
  skipped, like code after a `return`. Handlers, a transition to the state itself and a transition inside
  `if` cut nothing.
- b340f27: **`W017` — duplicate `interact` in one state, before any `transition to`.** The kernel's
  `exec_entry_statements` (`kernel-dsl/src/engine/fsm.rs`) stops running a state's entry statements as
  soon as `current_state` changes, so only `interact` statements preceding the first state-level
  transition can both execute and each emit their own `request_interact` effect, with no dedupe at the
  host layer (ADR DA00-09).
- b340f27: **Breaking: `W016` is now `E022` and blocks `pack()`.** A `guide`/`teach` reference resolving outside `guides/`/`knowledge/` used to warn and still bundle the file; `pack` now refuses before writing the archive, naming the file, the reference and the namespace it must move to. Resolves [platform#9](https://github.com/dot-agent-spec/platform/issues/9).
- b340f27: **`W012` generalized to `guide`/`teach`, not just `goal`.** Per ADR DA00-09, an Oriented State (one with
  `interact`) is the only state allowed to carry `goal`, `guide`, or `teach`; a Setup State (no `interact`)
  must carry none of them. `W012` previously checked only `goal`; it now fires for any of the three found
  without `interact` in the same state, and its message lists which ones are present.

### Patch Changes

- Updated dependencies [b340f27]
  - @dot-agent/parser-dsl@0.12.0-alpha.0
  - @dot-agent/tree-sitter@0.12.0-alpha.0

## 0.10.2 and earlier

Releases up to 0.10.2 were recorded by hand, in Keep a Changelog format, before this package moved to changesets. That history is kept in git: [CHANGELOG.md at 73b975b](https://github.com/dot-agent-spec/platform/blob/73b975bc1f4e88a18f47f89b711c8b5207b05e6c/packages/compiler/CHANGELOG.md).
