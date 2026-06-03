# The Behavior (.behavior)

The `.behavior` file defines an agent's logic through a deterministic state machine.

## 1. Scope & Standard States

The Runtime enforces a boundary between managed infrastructure and agent-defined logic.

### 1.1 Runtime Scope (Managed)
Systemic variables and states handled by the engine:
- **Variables**: `session.is_first_time`, `session.prompt_count`.
- **Infrastructure**: `compaction_threshold`, sandbox permissions.
- **Native States**: `online`, `offline`, `ended`.

### 1.2 Declarative Scope (Customizable)
Developers can create arbitrary states or override standard entry points:
- **Standard States**: `init`, `onboarding`, and the default `responsive` state.
- **Business States**: Custom states like `phases.planning` or `reservation`.

## 2. Memory Domains

Memory is scoped into four domains with distinct lifetimes:

| Domain | Lifetime | Use Case |
|---|---|---|
| `context` | Current turn | Active working memory for the LLM. |
| `session` | Conversation thread | Persistent data across turns in a thread. |
| `worksession` | Work unit | Data scoped to a specific task or objective. |
| `user` | Permanent | Long-term user preferences and history. |

## 2. State Anatomy

Every state follows one of two rigid structures to ensure predictability.

### 2.1 Oriented State (LLM Interaction)
Guides the LLM before releasing it to generate a response.
- **Structure**: `goal?` → `guide?` → `teach*` → `interact` → `handler+`
- **Keywords**:
  - `goal "..."`: Objective injected into message context.
  - `guide "..."`: Behavioral instructions in message context.
  - `teach "..."`: Injected into LLM's reusable cache (not context).
  - `interact`: Mandatory; awaits LLM response and dispatches to a handler.

### 2.2 Setup State (Orchestration Only)
Pure orchestration without LLM interaction. orientation and interaction keywords are **forbidden**.
- **Actions**: `run`, `set`, `apply`, `remove`, `transition`, `if`, `after`, `parallel`.

## 3. Flow Control

### 3.1 Handlers (Post-Interaction)
Handlers route the LLM's response. They can be **inline** or use a **block**.

| Trigger | Description |
|---|---|
| `on intent "..."` | Matches LLM-interpreted user intent. |
| `on fallback` | Triggered if actions/subagents fail or are unavailable. |
| `on offtopic` | Triggered if user conversation drifts from the state's goal. |

### 3.2 Actions & Composition
- **`run <type> <target> [label] [modifiers]`**: Types: `script`, `subagent`, `tool`. Modifiers: `silent`, `in background`.
- **`apply/remove <target> <file>`**: Modifies UI. Targets: `css`, `html`, `video`.
- **`merge "path"`**: Preamble only. Imports states from another file into the flat namespace.

## 4. Design Principles

- **Flat Hierarchy**: No nested states. Use `merge` for composition.
- **Procedural Guards**: `if/else` logic lives inside states, not as entry predicates.
- **Entry-Only Actions**: No "exit actions"; the LLM is stateless across turns.
- **Global Observers**: Use `on event` at the top level for background signals.

## 5. Tooling Requirements
IDE support **must** resolve file paths in `merge`, `run`, `guide`, and `teach` as clickable links relative to the workspace root.
