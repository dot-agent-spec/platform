<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0005: Type System

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-17 |
| Author | Danilo Borges |

---

## Summary

Define the complete type system for the dot-agent DSL — covering scalar primitives, multimodal and binary types, collection types, and semantic format annotations — along with the design philosophy that governs how the compiler, kernel, and SDK handle each category at compile time and runtime.

---

## Motivation

The current grammar has a solid semantic foundation for text-based data exchange, but it falls short of the requirements imposed by modern multimodal AI agents and complex data pipelines:

1. **Multimodal gaps** — LLMs such as Claude, GPT-4o, and Gemini natively accept and produce images, audio, and video. Without native types for these modalities, agents are forced to smuggle media as Base64 strings or bare URLs, losing all type-level safety and MIME validation.

2. **Missing collection types** — Without `array` or `object`, an agent cannot natively declare "a list of names" or "a JSON configuration object". These are fundamental to real-world inter-agent communication.

3. **No formal semantic annotation standard** — The grammar supports format hints (e.g. `string(email)`), but the vocabulary is undocumented. Without a standard, every implementor invents their own tokens, breaking portability.

4. **No explicit design contract** — The distinction between `string` and `text`, the meaning of the `table` type, and the runtime's role in type validation are not formally stated anywhere.

This RFC addresses all four gaps.

---

## Specification

### 1. Existing Primitive Types (Scalars)

These types are already supported by the current grammar. They map to a single MIME base type and compile to a scalar field in the agent's I/O schema.

| dot-agent DSL | MIME Base | JS | TS | Swift | Go | Rust | Kotlin | Python |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `string` | `text/plain` | `String` | `string` | `String` | `string` | `String` | `String` | `str` |
| `text` | `text/plain` | `String` | `string` | `String` | `string` | `String` | `String` | `str` |
| `number` | `text/plain` | `Number` | `number` | `Int`/`Double` | `int`/`float64` | `i32`/`f64` | `Int`/`Double` | `int`/`float` |
| `boolean` | `text/plain` | `Boolean` | `boolean` | `Bool` | `bool` | `bool` | `Boolean` | `bool` |
| `date` | `text/plain` | `Date` | `Date` | `Date` | `time.Time` | `NaiveDate` | `LocalDate` | `date` |
| `datetime` | `text/plain` | `Date` | `Date` | `Date` | `time.Time` | `DateTime` | `LocalDateTime` | `datetime` |
| `url` | `text/uri-list` | `URL` | `URL` | `URL` | `url.URL` | `url::Url` | `java.net.URL` | `HttpUrl` |

> `string` and `text` share the same MIME base but carry distinct semantic intent — see [§5](#5-design-philosophy-agnostic-intent-over-implementation).

---

### 2. Proposed: Multimodal & Binary Types

These types are **not yet in the grammar** and are proposed here. The compiler treats them as opaque byte buffers or file references. The SDK validates the MIME type at the system boundary before passing the value to the agent.

| dot-agent DSL | MIME Base | JS | TS | Swift | Go | Rust | Kotlin | Python |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `file` | `*/*` | `File`/`Blob` | `File`/`Blob` | `Data`/`URL` | `os.File` | `std::fs::File` | `java.io.File` | `bytes`/`IO` |
| `image` | `image/*` | `Blob` | `Blob` | `UIImage` | `image.Image` | `Vec<u8>` | `Bitmap` | `PIL.Image` |
| `audio` | `audio/*` | `Blob` | `Blob` | `AVAudioFile` | `[]byte` | `Vec<u8>` | `ByteArray` | `bytes` |
| `video` | `video/*` | `Blob` | `Blob` | `AVAsset` | `[]byte` | `Vec<u8>` | `ByteArray` | `bytes` |
| `binary` | `application/octet-stream` | `ArrayBuffer` | `Uint8Array` | `Data` | `[]byte` | `Vec<u8>` | `ByteArray` | `bytes` |

---

### 3. Proposed: Collection Types

These types are **not yet in the grammar** and are proposed here. Both compile to `application/json` at the wire level.

| dot-agent DSL | MIME Base | JS | TS | Swift | Go | Rust | Kotlin | Python |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `array<T>` | `application/json` | `Array` | `Array<T>` | `Array` | `[]T` | `Vec<T>` | `List<T>` | `list` |
| `object` | `application/json` | `Object` | `Record<K,V>` | `Dictionary` | `map[K]V` | `HashMap<K,V>` | `Map<K,V>` | `dict` |

The concrete syntax for generics is unresolved — see [Unresolved Questions](#unresolved-questions).

---

### 4. Semantic Types via Format Annotations

Semantic types **are not new keywords**. They reuse an existing scalar primitive paired with a format annotation using the syntax `primitive(format)`. The compiler treats the field as its base primitive; the SDK validates the format at runtime before the value is passed to the agent.

**Syntax example:**

```
type Email {
  value: string(email)
}
```

**Semantic type catalog:**

| Annotation | Base Primitive | MIME / Intent | JS/TS | Rust | Python |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `string(email)` | `string` | `text/plain` | `string` | `String` | `str` |
| `string(uuid)` | `string` | `text/plain` | `string` | `Uuid` | `UUID` |
| `string(hostname)` | `string` | `text/plain` | `string` | `String` | `str` |
| `string(ipv4)` | `string` | `text/plain` | `string` | `IpAddr` | `IPv4Address` |
| `string(ipv6)` | `string` | `text/plain` | `string` | `IpAddr` | `IPv6Address` |
| `string(time)` | `string` | `text/plain` | `string` | `NaiveTime` | `time` |
| `string(uri)` | `string` | `text/uri-list` | `string` | `url::Url` | `str` |
| `string(regex)` | `string` | `text/plain` | `RegExp` | `Regex` | `re.Pattern` |
| `string(currency)` | `string` | `text/plain` | `string` | `String` | `str` |
| `string(address)` | `string` | `text/plain` | `string` | `String` | `str` |
| `string(template "XXX")`| `string` | `text/plain` | `string` | `String` | `str` |
| `text(markdown)` | `text` | agnostic (MD/HTML) | `string` | `String` | `str` |
| `text(json)` | `text` | `application/json` | `any` | `serde_json::Value` | `dict` |
| `text(html)` | `text` | `text/html` | `string` | `String` | `str` |
| `table` | _(see §5)_ | agnostic (CSV/XLSX) | `Array` | `Vec<Vec<T>>` | `DataFrame` |
| `file(pdf)` | `file` | `application/pdf` | `Blob` | `Vec<u8>` | `bytes` |
| `file(zip)` | `file` | `application/zip` | `Blob` | `Vec<u8>` | `bytes` |
| `file(excel)` | `file` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `Blob` | `Vec<u8>` | `bytes` |

#### JSON Schema Format Vocabulary

The format token vocabulary adopts the **JSON Schema Format Vocabulary** as its normative reference. Implementations MUST support the following tokens where applicable:

- `date-time`, `time`, `date`
- `email`, `idn-email`
- `hostname`, `idn-hostname`
- `ipv4`, `ipv6`
- `uri`, `uri-reference`, `uuid`, `uri-template`
- `regex`, `json-pointer`

Custom format tokens (e.g. `pdf`, `zip`, `excel`, `markdown`) are dot-agent extensions to this vocabulary.

---

### 5. Design Philosophy: Agnostic Intent over Implementation

The `.agent` DSL is designed to be environment-agnostic — the same file must run correctly on a CLI, a desktop app, a server, or a WASM cluster without any I/O contract changes. Types must express **intent**, not implementation.

#### `string` vs `text`

These two types share the same underlying MIME base (`text/plain`) but carry different semantic intent:

- **`string`** — a raw, literal value: an identifier, a code, a label, a slug. The runtime renders it verbatim.
- **`text`** — rich content, always assumed to be Markdown by the grammar. The runtime decides how to render it: HTML in a browser, PDF in a document export, plain text in a terminal.

This distinction is **semantic only**. There is no character-count boundary or encoding difference between them.

#### `table`

The `table` type expresses the intent that the data is tabular — rows and columns. The grammar does not prescribe a serialization format. The runtime (e.g. `murici`) inspects the host context and chooses the appropriate representation: a `.csv` file in a terminal pipeline, an `.xlsx` file in a desktop export, a rendered HTML table in a web UI.

#### MIME-aware runtime validation

Because every type in this system maps to a MIME base, the kernel can automatically apply format validation before passing a value to the agent:

- A field typed `image` triggers magic-byte validation (PNG/JPEG/WebP headers) on the inbound buffer.
- A field typed `string(email)` triggers RFC 5322 format validation on the string value.
- A field typed `file(pdf)` triggers `%PDF-` header verification.

This eliminates boilerplate validation from user routines and makes type violations surfaceable at the boundary, not deep inside agent logic.

---

### 6. Strategic Priorities for Multimodal Agents

When agents interact with real-world tools — web scraping, RAG pipelines, data science, document processing — certain MIME types are load-bearing. The following should be prioritized in the initial multimodal implementation:

| Type | MIME | Primary Use Case |
| :--- | :--- | :--- |
| `file(pdf)` | `application/pdf` | The dominant asset format in RAG and contract analysis systems |
| `text(html)` | `text/html` | Standard return type of browser automation tools (Puppeteer, Playwright) |
| `file(zip)` | `application/zip` | Standard container for repository analysis and code generation outputs |
| `file(excel)` | `.../spreadsheetml.sheet` | The dominant format in financial and BI agent workflows |
| `image` | `image/*` | Required for vision-capable LLMs (Claude, GPT-4o, Gemini) |
| `audio` | `audio/*` | Required for speech-to-text and text-to-speech pipelines |

---

## Rationale

### Why `null`, `any`, and `void` are excluded

In a multi-agent system, types are **communication contracts**. An agent's input and output schema is its API. `null`, `any`, and `void` are escape hatches that weaken contracts — they shift the burden of type checking from the compiler and kernel to every consumer agent, reintroducing the very fragility the type system is designed to eliminate.

An agent that can return `any` provides no guarantee to the agent calling it. The calling agent must then defensively handle every possible shape, which is both error-prone and impossible to verify statically.

### Why semantic types prevent inter-agent communication failures

LLMs can hallucinate. If an agent is expected to return a `string(email)` but produces `"John Smith"`, the SDK catches the violation at the boundary and surfaces a typed error — before the malformed value propagates to the next agent in the pipeline. Without semantic types, that hallucinated value would silently corrupt downstream state.

### Why agnostic intent is necessary for runtime portability

A `.agent` file is a portable artifact. Binding its types to a specific serialization format (e.g. requiring `table` to be CSV) would break the portability guarantee. By encoding intent at the DSL level and delegating format decisions to the runtime, the same agent binary can operate correctly across every host environment without modification.

---

## Unresolved Questions

1. **Collection syntax** — Which generic syntax should be canonical?
   - Option A: `string[]` (suffix array syntax, familiar from TypeScript)
   - Option B: `array<string>` (explicit generic, consistent with the `array` keyword)
   - Option C: `[string]` (Swift-style shorthand)

2. **`table` classification** — Should `table` be a first-class primitive keyword, or a semantic annotation on `file` (i.e. `file(table)` or `file(csv)`)?

3. **Format validation strictness** — Should format annotation failures be compile-time errors, runtime errors, or configurable per annotation?

4. **Custom format registry** — Should dot-agent define a formal extension mechanism for custom format tokens beyond the JSON Schema vocabulary?
