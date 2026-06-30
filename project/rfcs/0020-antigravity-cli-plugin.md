<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0020: Antigravity CLI Plugin & Runtime Hooks

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-23 |
| Author | Danilo |
| Depends on | |
| Related | |

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| — | — | — | — | 🔄 |

> **Also impacts:** apps/agy (New App)

---

## Summary

This RFC proposes the creation of an Antigravity CLI (`agy`) plugin that embeds the `dot-agent` runtime (`packages/sdk` and `packages/kernel-dsl`). By registering as an MCP Server and subscribing to AGY Hooks (such as `PreToolUse`, `UserPromptSubmit`, and `SessionStart`), the `dot-agent` kernel will act as a dynamic policy engine and routing director for the host LLM, enforcing `.behavior` state machine rules directly inside the IDE.

## Motivation

Currently, agents operating in standard IDEs rely on "soft" guidance via system prompts or aggressive "hard" blocking via rigid tools (like `context-mode`). While these work, they are not programmable per project or state. We already have the declarative `.behavior` FSM capable of orchestrating complex logic, as seen in the `dogfood/` directory. If the `dot-agent` kernel hooks directly into the host runtime (AGY), we can dynamically inject/remove tools, modify the context window per state, and steer the LLM's workflow securely without relying on punitive error messages.

## Specification

1. **New App**: Create `apps/agy` as a git submodule to house the plugin bundle.
2. **Hook Registration**: The plugin will register hooks with AGY. When the host LLM attempts to call a tool, AGY calls `PreToolUse` on the plugin.
3. **Kernel Delegation**: The plugin translates the hook payload into an Effect for `kernel-dsl`. The kernel evaluates the current active `.behavior` state.
4. **Dynamic Context (teach)**: When entering a new state, the plugin uses AGY's Sidecar or System Prompt injection to enforce the `guide` and `teach` properties.
5. **Dynamic Tooling**: Tools are registered/deregistered with AGY dynamically based on the current state capabilities.

## Rationale

Embedding the kernel directly as an AGY plugin leverages AGY's deep extensibility (Hooks and Sidecars) to prove the viability of `dot-agent` as a universal host-level policy engine, shifting it from a "chatbot builder" to an "Agent OS".

## Implementation Notes

- Create `apps/agy` directory/submodule.
- Implement the `mcpServers` and `hooks` adapter in `packages/sdk` (L3).
- Write initial `guardrail.behavior` for testing.
- See related task: `tasks/antigravity-cli-plugin.md`.

## Open Questions

- How do we handle multi-agent collisions if multiple `.behavior` files are active in the same AGY workspace?
- Should the Sidecar UI be part of the plugin bundle or a separate extension?

## Host Portability: Claude Code

A viability analysis was conducted for porting this RFC to **Claude Code** (the Anthropic CLI) as a second host target (`apps/claude`).

### High-fit mappings

| AGY concept | Claude Code equivalent |
|---|---|
| MCP Server plugin | Native MCP server support via `settings.json` |
| `PreToolUse` hook | Native `PreToolUse` shell hook; non-zero exit blocks the tool call; stdout is relayed to Claude as feedback |
| `UserPromptSubmit` hook | Native hook; can inject the `teach` property content as extra context each turn |
| Kernel as policy engine | MCP server maintains FSM state; hook scripts communicate with it via socket or subprocess |

### Gaps (platform limitations, not solvable by iteration)

| AGY concept | Claude Code gap |
|---|---|
| Dynamic tool registration | MCP tools are loaded at session start — cannot add tools at runtime |
| Dynamic tool deregistration | Tools can only be **blocked** via `PreToolUse` (tool remains visible in tool list, execution is refused with state feedback) |
| `SessionStart` hook | Does not exist — approximation: detect first `UserPromptSubmit` of the session |
| System prompt injection mid-session | `CLAUDE.md` is read at startup; cannot be mutated without restarting the session |
| Sidecar UI | No UI extension architecture in the CLI |

### Architecture for `apps/claude`

```
dot-agent MCP server (owns FSM state)
    ↕ IPC (socket or subprocess)
PreToolUse hook script  →  check current state  →  block or allow
UserPromptSubmit hook   →  inject active state's `teach` as extra context
```

### Verdict

~75% viable. The "dynamic tooling" feature of the spec cannot be fully replicated — tools remain visible even when blocked by state. This should be documented as an **explicit divergence** if the plugin evolves to support multiple hosts: AGY hides tools by state, Claude Code refuses them by state. The behavioral outcome is similar but the UX differs.

## Decisions Closed
- The plugin will target `agy` (Antigravity CLI) specifically due to its robust hook architecture.
