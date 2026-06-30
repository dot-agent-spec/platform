<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# DA00-04: Parser optimization boundaries

> Migrated from legacy ADR-0003 under [DA00-01](DA00-01-traceability-scheme.md).

| Field | Value |
|---|---|
| Status | Accepted |
| Date | 2026-06-23 |
| Deciders | Danilo Borges |

---

## Context

The reference compiler for the `.agent` language specification uses Tree-sitter compiled to WebAssembly (`wasm32-wasip1`). As agentic codebases scale, full static analysis across hundreds or thousands of files can become a performance bottleneck during development and compilation. We investigated adopting aggressive optimization techniques inspired by large-scale static analyzers (like Graphify)—specifically, AST caching via deterministic hashes (e.g., MD5 + NFKC normalization) and multi-threaded parallel parsing (e.g., using Rayon). While these techniques yield massive speedups, enforcing them within the core WebAssembly parser introduces significant complexity and dictates how the host system must handle memory and threads. Furthermore, encoding caching behavior directly into the reference implementation risks forcing optimization assumptions onto third-party runtimes that might have entirely different constraints or prefer different approaches.

## Decision

We will keep the reference Tree-sitter Wasm parser single-threaded and stateless, deferring all responsibilities for caching and parallelism entirely to the host runtime (e.g., the CLI, IDE extension, or engine calling the parser).

## Options considered

- **Option A — Bake parallelism and cache directly into the Wasm core** — Maximizes out-of-the-box performance for everyone / Hard-couples the parser to specific thread/storage implementations, adding extreme complexity and potential incompatibility to the Wasm bundle.
- **Option B — Dictate caching strategies in the language spec** — Provides a standardized performance baseline / Forces runtimes to adopt a strategy they might not need or want, violating vendor neutrality and introducing premature overengineering.
- **Option C (chosen) — Stateless single-threaded parser, delegate optimizations to the host** — Keeps the compiler reference simple, highly portable, and vendor-agnostic / Places the burden of high-performance scaling (like multi-threading and disk caching) on the runtime developers who actually need it.

## Consequences

- The `dot-agent-spec` Wasm core remains lightweight, robust, and straightforward to maintain without dealing with Web Workers or `wasi-threads` complexities.
- The `.agent` specification remains agnostic of runtime performance implementations, adhering to standard compiler practices.
- For extremely large codebases, host environments (such as Node.js, Deno, or a Rust native runner) must implement their own `.agent-cache` strategies, calculate file hashes, and orchestrate workers to distribute parsing tasks across multiple instances of the single-threaded Wasm module.

## Related

