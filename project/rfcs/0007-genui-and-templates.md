<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0007: GenUI and Templates

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-17 |
| Author | Danilo Borges |

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |

---

## Summary

Define the design space for dynamic UI generation in the dot-agent DSL — covering HTML fragment injection, video layers, and a future template system that allows agents to compose and render structured UI at runtime.

---

## Motivation

The current grammar supports only `apply css` / `remove css` for UI manipulation. Early prototypes added `ApplyHtml`, `RemoveHtml`, `ApplyVideo`, `RemoveVideo` effects to the kernel and behavior-parser, but these were removed in June 2026 pending a formal design: the grammar never exposed the syntax, the security model was undefined, and the capability contract between agents and runtimes was unclear.

The `apply css` primitive covers lightweight UI hints (toggling classes, injecting inline styles). Richer UI composition — HTML fragments, video layers, declarative templates — requires a separate, more deliberate design that this RFC tracks.

---

## Scope

This RFC covers three related areas:

1. **`apply html` / `remove html`** — inject or remove HTML fragments or component identifiers into the host's rendering surface
2. **`apply video` / `remove video`** — start or stop a video resource layer
3. **Template system** — a higher-level primitive letting agents reference named UI templates declared outside the behavior (e.g., in the manifest or a dedicated `.templates` file)

---

## Open Questions

### 1. Security — XSS surface

`apply html` with raw HTML fragments is an XSS risk in any WebView-based runtime. Two design paths:

- **Component ID model**: `value` is a stable identifier (e.g., `"welcome-screen"`) that the runtime resolves to an actual component. The agent never touches raw HTML — the runtime owns the rendering.
- **Sanitized fragment model**: `value` is a sanitized HTML string; the runtime strips scripts and event handlers before injecting. Puts sanitization burden on every runtime implementor.

The component ID model is safer and aligns better with the capability model but requires runtimes to ship a component registry alongside the agent.

### 2. Capability gating

Should html/video effects require an explicit host capability declaration in `aboutme.json`?

```json
{ "requires": ["host.dom", "host.video"] }
```

Without this, an agent that emits `ApplyHtml` on a CLI runtime (which has no DOM) will produce unhandled effects silently. Capability gating lets the SDK fail fast at load time.

### 3. Value semantics

What does `value` contain for each kind?

| Kind | Candidate semantics |
|---|---|
| `html` | Component ID, template name, sanitized HTML fragment, or URL? |
| `video` | Resource URL, media ID, or manifest-declared asset reference? |
| `template` | Template name declared in manifest or `.templates` file? |

Each implies a different runtime contract and a different parser representation.

### 4. Template system design

Templates could live in several places:

- **In the manifest** (`aboutme.json`) — colocated with agent metadata, easy to bundle
- **In a dedicated `.templates` file** — keeps behavior files clean, parseable separately
- **Inline in `.behavior`** — maximum locality but adds grammar complexity

The template primitive may also need to parameterize (passing variables from FSM memory into templates), which interacts with the type system (RFC-0005).

### 5. Renderer abstraction and capability negotiation

Runtimes differ in rendering capability:

- Reference runtime (Electron/WebView): full DOM, CSS, video, HTML
- CLI runner: no DOM; must degrade gracefully or reject agents that require `host.dom`
- Future embedded runtimes: may have partial DOM or custom renderers

A formal capability negotiation protocol — where the runtime declares what it supports and the SDK validates agent requirements at load time — is prerequisite to safe `apply html` / `apply video` support.

---

## Proposed Syntax (tentative — not final)

```
apply html "component-id"
remove html "component-id"

apply video "resource-url"
remove video "resource-url"

apply template "welcome-screen"
remove template "welcome-screen"
```

Grammar change required in `packages/tree-sitter/behavior/grammar.js`: the `apply_stmt` and `remove_stmt` rules currently hardcode `'css'`. The target keyword would become a choice once this RFC is finalized.

---

## Relationship to Other RFCs

| RFC | Relationship |
|---|---|
| [RFC-0001: Addon Protocol](./0001-addon-protocol.md) | Lib addons may be the right mechanism to ship UI components alongside an agent; GenUI effects may invoke lib addons |
| [RFC-0004: Kernel Protocol](./0004-kernel-protocol.md) | New effects must be added to the kernel's `Effect` enum and WASM export contract once this RFC is finalized |
| [RFC-0005: Type System](./0005-type-system.md) | Template parameters likely require typed fields; multimodal types (image, video) intersect with the video layer |
