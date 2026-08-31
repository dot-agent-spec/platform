---
vibe-ops-template: task@3
---

# Task: Antigravity CLI Plugin Implementation

| Field | Value |
|---|---|
| Status | Planned |
| Created | 2026-06-23 |
| Author | Danilo |
| Issue | — (no tracking issue; the design record is RFC-0020) |
| Sources | [RFC-0020](../rfcs/0020-antigravity-cli-plugin.md) |

---

## Context

Following RFC-0020, we need to implement the `dot-agent` plugin for Antigravity CLI (`agy`). This will allow the `kernel-dsl` to direct interactions, shape tools dynamically, and guide the host agent using `.behavior` state machines. The app will be housed in `apps/agy`.

## Priority overview

| # | Priority | Item | Package(s) | Effort |
|---|---|---|---|---|
| 1 | P0 | Bootstrap `apps/agy` submodule | apps/agy | S |
| 2 | P0 | Implement `agy` Hook adapter in SDK | packages/sdk | M |
| 3 | P1 | Dynamic Tool Registration Sync | packages/sdk, apps/agy | M |
| 4 | P1 | Sidecar State Visualizer | apps/agy | L |

---

## Work items

### 1. Bootstrap `apps/agy` submodule — P0

**What:** Create the `apps/agy` directory as a submodule containing the plugin configuration (`.mcp.json`, `hooks.json`).

**Why:** Required to package the plugin for installation via `agy plugin install`.

**Change:** Init repo, add package structure, update monorepo `AGENTS.md` and `README.md`.

### 2. Implement `agy` Hook adapter in SDK — P0

**What:** Map AGY's `PreToolUse` and `SessionStart` hooks to `kernel-dsl` inputs.

**Why:** This is the core interception mechanism.

**Change:** Add hook handler routes in `packages/sdk` that evaluate current `.behavior` states.

### 3. Dynamic Tool Registration Sync — P1

**What:** Update the MCP server exposed by the plugin to dynamically reflect the tools allowed in the current state.

**Why:** To prevent the LLM from hallucinating tools that are out-of-scope for the current workflow step.

**Change:** Tie FSM state transitions to MCP `list_tools` updates.

### 4. Sidecar State Visualizer — P1

**What:** A webview/Sidecar pane showing the active FSM graph.

**Why:** Improves developer experience by making the agent's internal state machine visible and interactive.

**Change:** HTML/JS dashboard injected via AGY Sidecar API.

---

## Implementation order

```
P0: Bootstrap apps/agy
P0: Implement Hook Adapter in SDK
P1: Dynamic Tool Sync
P1: Sidecar Visualizer
```

## Surprises & Discoveries

<!-- Fill this WHILE the work happens; reconstructed at the end it is worthless. One entry per non-obvious
     fact the work turns up. At closure each is routed: does it hold beyond this repository (-> a workspace
     learning), can you name the file or package where someone meets it again (-> project/log/), or
     neither (-> dropped, out loud). -->

- Observation: …
  Evidence: …

## Closure

- [ ] Run `/vibe-ops:close-task` — do not just delete this file. Stays unchecked until closure actually
      runs; a dossier that looks otherwise finished but has this box open is not done.
