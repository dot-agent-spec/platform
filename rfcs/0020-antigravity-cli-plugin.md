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

## Decisions Closed
- The plugin will target `agy` (Antigravity CLI) specifically due to its robust hook architecture.
