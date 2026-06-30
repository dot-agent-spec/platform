# RFC-0021: System Behavior

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-26 |
| Author | Danilo Borges |
| Depends on | |
| Related | |

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| — | — | ⚠️ | ⚠️ | ⚠️ |

## Problem

Currently, the `dot-agent` language does not have a formal standard library or standard base behavior. The entry point of an agent is simply the first state defined in its main behavior file.

We want to introduce standard structural patterns (e.g., standard states like `init`, `onboarding`, `responsive`, `ended`) without forcing every author to manually write boilerplate. 

## Proposed Solution

Introduce a "System Behavior" concept—a pre-configured `.behavior` file (similar to a Prelude) that is loaded implicitly by the kernel before any user-defined behaviors. 

1. **SDK**: The SDK will embed the `system.behavior` and pass it to the Kernel during initialization (e.g. inside `load_behavior_with_bundle` as the base).
2. **Kernel (`kernel-dsl`)**: The kernel parses the `system.behavior` first, populating its internal `states` map. It then parses the user's main behavior and merges. If the user defines a state with the same name (e.g., `init`), it overwrites the system's state, effectively customizing the flow (override semantics). The very first state of the System Behavior becomes the fixed initial entry point.
3. **Compiler (`@dot-agent/compiler`)**: The linter needs to treat the states defined in `system.behavior` as implicitly available so that a `transition to responsive` in the user's file does not emit `E005: Undefined state`, even if the user hasn't explicitly defined it.

This approach provides a guaranteed standard structure and natural override capabilities without breaking the language's current execution model.
