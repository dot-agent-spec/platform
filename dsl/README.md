# dsl/

Language specification for the dot-agent ecosystem. Everything here is about **writing** `.description` and `.behavior` files — syntax, semantics, design.

For package internals (compiler, kernel, SDK APIs), see [`docs/`](../docs/).

The current language capability tier is recorded in [`VERSION`](VERSION) — the DSL's own version, independent of any package's semver (see [DA00-02](../project/adr/DA00-02-two-axis-versioning.md)). Every `.agent` bundle stamps this value into `aboutme.json`'s `dslVersion` field at pack time.

---

## Structure

This directory follows the [Diátaxis](https://diataxis.fr/) framework:

| Folder | Purpose |
|---|---|
| [`reference/`](reference/) | Complete syntax specifications — keywords, statements, forms. The authoritative source for what the language accepts. |
| [`explanation/`](explanation/) | Design background — why the language is the way it is. Read this to understand the reasoning behind constraints. |
| [`how-to/`](how-to/) | Practical recipes for common authoring tasks. |
| [`tutorials/`](tutorials/) | Step-by-step guides for learning the language from scratch. |

---

## Quick links

**Reference:**
- [`.behavior` syntax](reference/behavior.md) — states, keywords, statements, handlers
- [`.description` syntax](reference/description.md) — agent identity, capabilities, type declarations
- [Type system](reference/types.md) — custom types, primitives, namespace resolution
- [Memory domains](reference/memory.md) — `context`, `session`, `worksession`, `user`

**Explanation:**
- [Design principles](explanation/design-principles.md) — zero noise, determinism, small vocabulary
- [Scope](explanation/scope.md) — what `.behavior` is and is not
- [`.behavior` vs. WASM](explanation/behavior-vs-wasm.md) — when to use each
- [Antipatterns](explanation/antipatterns.md) — common mistakes and alternatives

**Proposed features (RFCs):**
- [RFC-0014](../rfcs/0014-data-contract.md) — Data contract (`on intent with TypeName`, `complete`)
- [RFC-0015](../rfcs/0015-cross-agent.md) — Cross-agent calls (`start ... in`)
- [RFC-0016](../rfcs/0016-string-constraints.md) — String constraints & primitive types
- [RFC-0017](../rfcs/0017-standard-library.md) — Standard library (`std.*`)
