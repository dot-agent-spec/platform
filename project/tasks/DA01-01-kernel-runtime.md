# Task: Kernel Runtime — DA01-01 Impact + v0.1 Debts

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-06-26 |
| Author | Danilo Borges |
| Decision Log | [DA01-01: Forgiving Syntax and Prettifier](../pre-release/v0.1/DA01-01-forgiving-syntax.md) |
| Depends on | `DA01-01-grammar-unfreeze.md` ✅ Done · `DA01-01-ast-mapper-fixes.md` ✅ Done |

The grammar unfreeze (KD-1–KD-6) and AST mapper fixes are complete in `parser-dsl`. `fsm.rs` already compiles against the updated types (all renames landed). Two behavioral runtime gaps remain for v0.1: `merge` is not resolved at runtime, and transitions to native states (`ended`) are silently dropped.

`on_failure` is formally deferred to v0.2 (see §3).

---

## 1. `merge` — runtime resolution — P1 · v0.1

**Source:** `pre-public-consolidation.md` C2 · `implementation-status.md` ⚠️ kernel-dsl + sdk

### Problem

The parser produces `BehaviorFile.merges: Vec<MergeDecl>` with the paths declared in `merge "path/to/other.behavior"`. `Fsm::new(behavior)` completely ignores the `merges` field — states from merged files never enter the FSM map. Transitions to states defined in merged files fail silently inside `transition_to`.

On the SDK side: `files.behaviors[]` is loaded but **not passed to the kernel**. The `load_behavior(text)` API receives only the main file's text.

### Compiler state today

The compiler does **not** produce a flattened `BehaviorFile` with resolved merges. The linter (`linter.ts:210-229`) has an internal `collectMergedStates()` — it reads referenced files from disk via `readFileSync` to collect state names and detect duplicates — but this is a side-effect of linting, not a public API. There is no function that returns a fully merged `BehaviorFile` ready for the kernel.

### Dependency

None. The kernel must be self-sufficient and perform the merge flattening internally, without depending on the compiler package for runtime execution.

### Design

The kernel (`kernel-dsl`) will support two modes for resolving merges:
- **Mode A (Primary):** The SDK passes a JSON bundle mapping paths to contents directly into the kernel's load function: `load_behavior_with_bundle(main_text, bundle_json)`. The kernel uses this pre-loaded memory to flatten the AST.
- **Mode B (Fallback):** The kernel exposes a synchronous WASM callback `set_file_resolver`. If a `merge` is found and its path isn't in the provided bundle (or if the bundle is omitted), the kernel calls this fallback to request the file content. 

This ensures that the kernel is resilient and errors related to missing files are properly handled at runtime (not prematurely by the compiler).

```ts
// sdk/AgentSession — sketch
kernel.set_file_resolver((path) => fetchBehavior(path)); // Fallback Mode B
kernel.load_behavior_with_bundle(mainBehavior, JSON.stringify(files.behaviors)); // Primary Mode A
```

### Work items

1. ✅ **Kernel (`kernel-dsl`)** — `flatten_merges` internal helper; `load_behavior_with_bundle` and `set_file_resolver` APIs added to both `engine/mod.rs` and `lib.rs` (WASM).
2. ✅ **SDK** — update `AgentSession.start()` to pass the `files.behaviors` bundle and register a fallback resolver.
3. ✅ **Tests** — Mode A (bundle), Mode B (resolver fallback), missing merge path is an error, resolver returning None is an error, main state shadows duplicate from merged file. 13/13 passing.

---

## 2. Native state transitions — P1 · v0.1

**Source:** `compiler-work.md` §1 covers the linter side (E005 allowlist); this task covers the runtime.

### Problem

`transition_to` in `fsm.rs` silently drops any transition whose target is not in `self.states`:

```rust
fn transition_to(&mut self, target: &str, _mem: &mut MemoryStore) -> Vec<Effect> {
    let from = self.current_state.clone();
    if self.states.contains_key(target) {   // native states always fail here
        self.current_state = target.to_string();
        self.prompt_count = 0;
        vec![Effect::Transition { from, to: target.to_string() }]
    } else {
        vec![]                              // silent drop
    }
}
```

Native states (`ended`) are never declared in a `.behavior` file, so `self.states.contains_key("ended")` is always false. `transition to ended` emits zero effects and does not update `current_state`. (Note: `online` and `offline` are events, not states).

### Fix

```rust
const NATIVE_STATES: &[&str] = &["ended"];

fn transition_to(&mut self, target: &str, _mem: &mut MemoryStore) -> Vec<Effect> {
    let from = self.current_state.clone();
    if self.states.contains_key(target) || NATIVE_STATES.contains(&target) {
        self.current_state = target.to_string();
        self.prompt_count = 0;
        vec![Effect::Transition { from, to: target.to_string() }]
    } else {
        vec![]
    }
}
```

### Work items

1. ✅ `fsm.rs` — add `NATIVE_STATES` constant and update the guard in `transition_to`.
2. ✅ Test: behavior with `transition to ended`; verify `Effect::Transition { to: "ended" }` is emitted and `get_current_state()` returns `"ended"`.

---

## 3. `on_failure` handler dispatch — DEFERRED v0.2

**Source:** `implementation-status.md` · DA01-01 forgiving-syntax §4.2

The parser populates `on_failure` on `RunStmt`, `Apply`, `Remove`, and `Parallel`. `fsm.rs` ignores all of them with `..` / `on_failure: _`.

**Formally deferred to v0.2.** `implementation-status.md` annotates `(v0.2)` on all `on failure` rows. The `send_complete()`/`send_failed()` APIs were removed with the note: *"on failure execution is v0.2; no API entry point."*

### Architectural context (recorded here for v0.2)

The FSM is synchronous — `exec_statements` returns `Vec<Effect>` immediately. The kernel emits effects but does not execute them; the WASM/JS host executes them and knows whether a script failed. For `on_failure` to work, the host needs a return path into the kernel.

Options to evaluate in v0.2:

**Option A — Contingency effects:** add `on_failure: Vec<Effect>` to the `Effect::RunScript/Subagent/Tool` variants. The host executes the contingency effects if the script fails. Transitions inside `on_failure` require a separate kernel call.

**Option B — `send_run_failure` callback:** the FSM suspends the statement sequence after emitting a Run effect and stores the pending `on_failure` body. The host calls `send_run_failure()` on failure; the kernel resumes with the handler.

Decide and implement in v0.2. Record the decision here.

---

## Implementation order

```
v0.1:
1. Native states (§2)          ─ self-contained, ship first
      ↓ 
2. merge runtime (§1)           ─ Kernel implements internal merge flattening (Mode A & B)

v0.2:
4. on_failure dispatch (§3)    ─ design decision + implementation
```
