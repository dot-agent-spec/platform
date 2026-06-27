# Task: Evaluate Mandatory Initial State

| Field | Value |
|---|---|
| Status | Done |
| Created | 2026-06-26 |
| Closed | 2026-06-27 |
| Author | Danilo Borges |
| Sources | RFC-0021 (System Behavior) |
| Resolution | [DA01-02 log](../pre-release/v0.1/DA01-02-compiler-behavior-consolidation.md) — `init` chosen as canonical entry name; E016 enforces presence; kernel uses `states.get("init")`. Implementation tracked in [DA01-02-behavior-consolidation.md](DA01-02-behavior-consolidation.md). |

---

## Context

Currently, the Kernel simply sets the initial state to the first state parsed in the main file (`state_order.first()`). Since a `.description` maps 1:1 to a main `.behavior` (which then maps 1:N to merges), the main file is clearly identified and its first state acts as the natural entry point.

However, as the language scales and with the introduction of a `system.behavior` (RFC-0021), relying purely on file ordering for the entry point might become brittle or confusing. We need to evaluate whether to enforce a mandatory named initial state (e.g., `init`, `begin`, or `start`).

## Work items

1. **Evaluate semantic keywords**: Decide whether a keyword or a specific reserved state name (`init`) is the right choice for an explicit entry point.
2. **Maintain current behavior (for now)**: The Kernel continues to use the first registered state in the main file as the entry point. No breakage to existing examples.
3. **Linter rule (future)**: If a mandatory state name is chosen, design the linter rule (e.g., `E009: Missing entry state 'init'`) to enforce its presence across the merged bundle.
