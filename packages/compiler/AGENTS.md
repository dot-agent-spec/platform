# @dot-agent/compiler — Agent Guidelines

The Level 1 tooling engine: linting (`E*`/`W*` diagnostics), behavior-graph extraction, `aboutme.json`
manifest construction, agent-ID formatting, and the `.agent` ZIP pipeline.

**What it is not** is the useful half of that sentence. No CLI argument parsing, no LSP JSON-RPC, no
runtime execution — those are `dot-agent-cli`, `language-server` and `@dot-agent/sdk`. A change that needs
one of them does not belong here.

Its own internals are documented in [`docs/`](docs/): the pipeline in `concepts/pipeline.md`, the calling
convention in `guides/linting.md`, and every diagnostic code in `reference/lint-codes.md`.

## The grammar stopped enforcing shape — the linter does

This is the correction that matters most, because this file asserted the opposite as hard requirements
until 2026-08-13, and a reader trusting it would look for grammar errors that can no longer occur.

RFC-0022 flattened the grammar: `state_body` is now `repeat1(choice(...))` and `oriented_state_body` **does
not exist**; `agent_decl` is `repeat(choice(...))`, so `.description` blocks are accepted in **any order**.
Everything that used to be a parse failure is now a lint rule:

- a state with `interact` must declare `goal`
- an oriented state must end with `on offtopic`
- `goal` belongs only to an oriented state
- the canonical `description → persona → behavior → capabilities → requires → input → output` order

The grammar accepts all of it. If one of those must fail, it fails in `src/linter.ts` or nowhere.

## Node type names

They come from the grammars, and hardcoding one without checking is how a silent mismatch gets in:

- [`packages/tree-sitter/tree-sitter-behavior/grammar.js`](../tree-sitter/tree-sitter-behavior/grammar.js)
- [`packages/tree-sitter/tree-sitter-description/grammar.js`](../tree-sitter/tree-sitter-description/grammar.js)

One that surprises people: `domain`, `license`, `terms` and `privacy` are `agent_meta` nodes carrying
`key`/`value` fields. There is no `domain_declaration` node and never was.

`web-tree-sitter` has no `Parser.SyntaxNode` / `Parser.Tree` namespace — import `Node` and `Tree`
standalone. True since 0.25; this package is on `^0.26.9`.

## Adding a lint rule

1. Implement it in `src/linter.ts`, on an unused `E*` (error) or `W*` (warning) code.
2. Test both directions in `tests/linter.test.ts` — input that triggers it **and** valid input that must
   not. A rule with only the positive test passes while firing on everything.
3. Add its row to [`docs/reference/lint-codes.md`](docs/reference/lint-codes.md).

## Testing

```bash
npm test
```

`vitest.config.ts` sets `pool: 'forks'` with a single fork, and that is load-bearing rather than tuning:
WASM initialisation is process-global, so worker threads cannot share it and a parallel run fails in ways
that look like parser bugs.

## Keeping this file current

Updating it is part of any task that changes what this package owns or how it is tested. Triggers: a
responsibility moves in or out of the boundary above; a grammar rule moves between parser and linter; the
node-type source moves; the test pool constraint changes.

**The trigger already missed once is a rule moving from grammar to linter.** RFC-0022 did exactly that,
and this file kept describing the old grammar — as did `packages/tree-sitter/AGENTS.md`,
`project/implementation-status.md`, and `.agents/skills/sync-implementation-status/SKILL.md`, which is the
one that actually loads and runs. Recorded in
[`project/tasks/per-package-agents-md.md`](../../project/tasks/per-package-agents-md.md).
