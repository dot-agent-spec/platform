<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0017: Standard Library (`std.*`)

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-19 |
| Author | Danilo Borges |
| Related | [RFC-0005](0005-type-system.md) — type system that governs `std.*` resolution |

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| — | — | ⚠️ | — | ⚠️ |

---

## Summary

Define the `std.*` standard library: a set of semantic compound types provided by the Runtime for use in `.description` type declarations and `.behavior` data contracts. These types cover the most common multimodal inputs and outputs without requiring agent authors to redeclare them.

---

## Motivation

Agent authors frequently need the same compound types: a prompt that can include text, audio, and image; a speech clip with optional transcription; a video file. Without a standard library, every agent redeclares these types independently, with inconsistent field names and semantic anchors. This makes cross-agent data contracts fragile.

`std.*` provides a shared, versioned vocabulary that the Runtime resolves before checking local declarations. The Runtime — not the grammar — is responsible for resolution: the tree-sitter grammar accepts `std.Prompt` as a valid `ns.Identifier` type reference, but the structure is defined here.

---

## Resolution Rules

1. **Namespace**: all standard library types live under the `std` namespace (`std.TypeName`).
2. **Shadowing**: a local `type Prompt` always shadows `std.Prompt`. Agent authors can override any `std.*` type. See [RFC-0005](0005-type-system.md) §namespace-resolution for precedence rules.
3. **Grammar**: the tree-sitter grammar accepts `std.*` references as valid type expressions — no special grammar rule is needed.
4. **Runtime**: the Runtime resolves `std.*` references at load time, before executing any behavior. Missing or misspelled `std.*` references are a compile-time error (reported by `@dot-agent/compiler`).

---

## Type Definitions

### `std.Prompt`

Represents the fundamental input for an LLM. In modern multimodal models, a prompt is rarely just text — it can be accompanied by audio (voice commands) and image (visual analysis).

```
type std.Prompt
  concept https://schema.org/Message
  content: text              // 'text' instead of 'string' — supports Markdown and long blocks
  audio?: file(audio)
  video?: file(video)
  image?: file(image)
```

### `std.Image`

Encapsulates a pure image with its semantic anchor and binary buffer.

```
type std.Image
  concept https://schema.org/ImageObject
  content: file(image)       // resolved as image/* buffer by the SDK
  alt?: string               // optional short descriptive text
```

### `std.Speech`

Represents speech or a narrated audio clip. Used for Text-to-Speech and Speech-to-Text agents.

```
type std.Speech
  concept https://schema.org/AudioObject
  content: file(audio)       // the audio buffer
  text?: text                // optional transcription
  video?: url                // URL if hosted remotely
```

---

## Open Questions

- Should `std.*` types be versioned independently (e.g. `std.v2.Prompt`) or always track the spec version?
- Should additional types be included in this RFC (`std.Video`, `std.Document`) or deferred to a follow-up?

---

## Decisions Closed

- **Runtime, not grammar, resolves `std.*`** — The grammar accepts the namespace form `ns.Identifier`; the Runtime provides the actual structure. This keeps the grammar stable as the standard library evolves.
- **Local declarations shadow `std.*`** — Confirmed. See RFC-0005 §namespace-resolution.
