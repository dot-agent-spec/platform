# tree-sitter-behavior

**Tree-sitter grammar for the `.behavior` file format of the .agent DSL.** It parses the flat state
machine that drives a dot-agent runtime — states, transitions, intent handlers, actions — into the
syntax tree that editor highlighting and the language server run on.

<p align="center">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="Apache-2.0"></a>
</p>

<p align="center">
  <a href="#example">Example</a> ·
  <a href="grammar.js">Grammar</a> ·
  <a href="queries/highlights.scm">Highlights</a> ·
  <a href="test/corpus">Corpus tests</a> ·
  <a href="..">Parent package</a>
</p>

---

| Grammar | Scope | File types |
|---|---|---|
| `grammar.js` | `source.behavior` | `.behavior` |

## Why

A `.behavior` file is a flat state machine: each `state` holds a prompt (`goal`, `guide`, `teach`) and
its routing (`on intent`, `on offtopic`, `on failure`). Rather than every consumer hand-writing a parser
for that shape, this grammar compiles once with Tree-sitter and is reused everywhere a `.behavior` file
needs an incremental, error-tolerant syntax tree — the VS Code extension's highlighting, the language
server's diagnostics, and the linter's structural checks all read the same tree.

The grammar is **keyword-driven, not newline-driven**: whitespace is insignificant and lives in
`extras`, so structure comes entirely from reserved keywords and an explicit `end` terminator. It is
also deliberately permissive — ordering, block uniqueness and which native states are legal are left to
the linter, not enforced here, so `state_body` is a flat, shared node for every kind of state.

## Example

Given this `.behavior` source (from [`test/corpus/states.txt`](test/corpus/states.txt)):

```behavior
state responsive
  goal "Help the user"
  interact
  on intent "request" transition to responsive
```

parsing it produces:

```
(behavior_file
  (state_decl
    (state_name)
    (state_body
      (goal_stmt
        (quoted_string))
      (interact_stmt)
      (intent_handler
        (quoted_string)
        (transition_stmt
          (state_name))))))
```

## Usage

This grammar is not published as its own npm package — it is compiled and shipped as part of the parent
[`@dot-agent/tree-sitter`](..) package, which vendors its `grammar.js`, `queries/` and
`src/node-types.json` and builds it into `dist/tree-sitter-behavior.wasm`.

To work on the grammar directly, from the parent package root (`packages/tree-sitter/`):

```bash
npm install
npm run generate-behavior   # compile grammar.js → src/parser.c
npm run test-behavior       # run test/corpus against the compiled parser
```

Or with the Tree-sitter CLI from inside this directory:

```bash
npx tree-sitter generate
npx tree-sitter test
npx tree-sitter parse path/to/file.behavior
npx tree-sitter highlight path/to/file.behavior
```

**Re-run `generate` after every edit to `grammar.js`.** `src/parser.c`, `src/grammar.json` and
`src/node-types.json` are generated output — a stale `parser.c` disagrees with the grammar silently, and
nothing warns an editor when it does.

## Requirements

Node.js 24 or newer, and `tree-sitter-cli` (a dev dependency of the parent package).

## Learn more

The language this grammar parses is specified in
[`dsl/reference/behavior.md`](../../../dsl/reference/behavior.md); the parsed tree reaches editors
through [`packages/language-server`](../../language-server) and
[`apps/vscode-extension`](../../../apps/vscode-extension).

## License

Apache 2.0 — see [`LICENSE`](../LICENSE). `src/tree_sitter/*.h` are vendored from the Tree-sitter
project (MIT) — see [`NOTICE`](../NOTICE).
