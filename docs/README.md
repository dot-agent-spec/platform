# docs/

Implementation documentation for the dot-agent ecosystem. Everything here is about **building on** the packages — APIs, interchange formats, architecture.

For **language syntax** (how to write `.behavior` and `.description` files), see [`dsl/`](../dsl/).

---

## Structure

This directory follows the [Diátaxis](https://diataxis.fr/) framework:

| Folder | Purpose |
|---|---|
| [`reference/`](reference/) | Technical specifications — BehaviorFile, DescriptionFile, kernel API, agent-id, compiler lint codes |
| [`explanation/`](explanation/) | Architecture maps, ecosystem overview, design decisions |
| [`how-to/`](how-to/) | Practical guides — packaging, SDK usage |
| [`tutorials/`](tutorials/) | Step-by-step guides for newcomers (WIP) |

---

## Quick links

**Reference:**
- [BehaviorFile interchange contract](reference/behavior-file.md)
- [DescriptionFile interchange contract](reference/description-file.md)
- [Kernel DSL API](reference/kernel-dsl.md)
- [Agent ID](reference/agent-id.md)
- [`.behavior` runtime scope](reference/behavior.md)
- [`.description` runtime scope](reference/description.md)
- [Types — compiler validation & `types.json`](reference/types.md)

**Explanation:**
- [Architecture map](explanation/architecture/map.md) — package dependency hierarchy, execution sequences
- [Ecosystem overview](explanation/architecture/ecosystem.md)
- [Design principles](explanation/architecture/design-principles.md)

*Component-specific internals (compiler pipeline, parser AST) are documented in `packages/*/docs/`, not here.*
