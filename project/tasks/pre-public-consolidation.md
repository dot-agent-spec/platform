# Task: Pre-Public-Share Consolidation

| Field | Value |
|---|---|
| Status | **Done** ✅ |
| Created | 2026-06-22 |
| Closed | 2026-06-27 |
| Author | Danilo Borges |

---

All build/packaging and correctness/DSL items resolved. Compliance check run 2026-06-27 confirmed green builds and tests across all packages. See [compliance report](../pre-release/v0.1/compliance-check-2026-06-27.md) for full findings.

| # | Priority | Item | Status |
|---|---|---|---|
| B1 | P0 | `publishConfig` on `parser-dsl` | ✅ |
| B2 | P0 | Version strategy decision | ✅ DA00-02 |
| C3 | P0 | `files.json.behavior` derived from DSL | ✅ DA01-02 |
| C2 | P1 | `merge` resolved at runtime | ✅ DA01-01 |
| B3 | P1 | Stale `wasm-pack` defs removed | ✅ |
| B4 | P1 | ts-rs AST types exported from parser-dsl public API | ✅ |
| B5 | P1 | `pkg-web/` orphan resolved | ✅ |
| C4 | P1 | `aboutme.purpose` placeholder | ✅ accepted for v0.1 |
| C5 | P1 | Bundle validation dedup (compiler ↔ sdk) | ✅ |
| B6 | P2 | WASM post-processing centralised | ✅ |
| B7 | P2 | `build.rs` shared | ✅ |
| B8 | P2 | `tree-sitter` `.d.ts` | ✅ |
| C1 | — | `on failure` grammar → DA01-01 | ✅ |
| C6 | — | Dead AST nodes → DA01-01 | ✅ |
