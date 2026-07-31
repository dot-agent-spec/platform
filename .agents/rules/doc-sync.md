---
description: Definition of done for a change to the layered packages — which docs must move with the code, how a language change propagates from grammar to SDK, and what examples/ is for.
paths: ["packages/**", "dsl/**", "examples/**", "docs/**", "project/implementation-status.md"]
---

## Changing a layer — what has to move with it

Doc drift across the layered packages is this repository's main failure mode: each layer has its own
docs, and a change lands in one while the others keep describing the old shape. **Treat the doc update as
part of the change, not a follow-up.**

After any change, walk the affected row in
[`../../project/implementation-status.md`](../../project/implementation-status.md), update every layer it
touches, then run the `/sync-implementation-status` skill to regenerate the tracker and surface what was
missed.

| If you change… | Also update… |
|---|---|
| Grammar / new syntax (`packages/tree-sitter`) | `dsl/reference/` · `packages/parser-dsl` AST · `packages/compiler` lint · `packages/kernel-dsl` (if it has runtime behavior) · `examples/` · the `implementation-status.md` row · that package's `AGENTS.md` |
| A kernel effect (`packages/kernel-dsl`) | `packages/sdk` handler · `dsl/reference/behavior.md` · `implementation-status.md` |
| An `aboutme` / pack field (`packages/compiler`) | `dsl/reference/description.md` · `implementation-status.md` |
| Top-level folders or packages | `README.md` · root `AGENTS.md` (layout tree + source-of-truth table) · `docs/explanation/architecture/map.md` (View 1 + Implementation Status table) |

That last row matters more than it looks: `README.md` and `AGENTS.md` are the entry points for both human
contributors and AI collaborators, and **stale layout information there is a primary source of
hallucination** — an agent will confidently use a path that no longer exists.

## Evolving the language

- A language change must be reflected in **both** `dsl/reference/` and the grammar in
  `packages/tree-sitter/`.
- Grammar changes take effect only after regenerating `parser.c` in
  `packages/tree-sitter/tree-sitter-behavior/src/`.
- Files in `examples/` must remain valid against the current grammar — they are CI-tested.
- Proposed new syntax goes through an RFC (`project/rfcs/`) **before** the grammar is touched; a
  hard-to-reverse decision is recorded as an ADR. See [`../../GOVERNANCE.md`](../../GOVERNANCE.md).

## What `examples/` is

The `.description` and `.behavior` files in `examples/` are **specification documents, not compiled
code** — they exist to show the canonical shape of each construct. Each example has a companion `src/`
folder with the source files and a compiled output in `<Name> - content/`.
