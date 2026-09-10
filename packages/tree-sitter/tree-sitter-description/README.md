# tree-sitter-description

**Tree-sitter grammar for the `.description` and `type` file formats of the .agent DSL.** It parses an
agent's manifest — its metadata, capabilities, inputs and outputs — and the `type` declarations it
requires, into the syntax tree that editor highlighting and the language server run on.

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
| `grammar.js` | `source.description` | `.description`, `type` |

## Why

A `.description` file declares an agent's contract — what it needs, what it can do, what it returns —
and a `type` declaration shapes the data those capabilities pass around. Rather than every consumer
hand-writing a parser for that shape, this grammar compiles once with Tree-sitter and is reused wherever
a `.description` or `type` file needs an incremental, error-tolerant syntax tree — the VS Code
extension's highlighting, the language server's diagnostics, and the compiler's semantic validation all
read the same tree.

Unlike its sibling grammar for `.behavior` files, **newlines are significant here**: `_newline: $ =>
/\r?\n/` is a real rule, and structure is delimited by keywords *and* newlines together, not by keywords
and an `end` terminator alone.

## Example

Given this `type` source (from [`test/corpus/types.txt`](test/corpus/types.txt)):

```description
type BankStatement
  category https://www.wikidata.org/wiki/Q806653
  account: Person
  transactions: [Transaction]
  balance: number
```

parsing it produces:

```
(manifest
  (statement
    (type_decl
      name: (identifier)
      (category_prop
        uri: (url))
      (property_decl
        name: (identifier)
        type: (type_value
          (type_reference
            (identifier))))
      (property_decl
        name: (identifier)
        type: (type_value
          (type_reference
            (identifier))))
      (property_decl
        name: (identifier)
        type: (type_value
          (primitive_type))))))
```

## Usage

This grammar is not published as its own npm package — it is compiled and shipped as part of the parent
[`@dot-agent/tree-sitter`](..) package, which vendors its `grammar.js`, `queries/` and
`src/node-types.json` and builds it into `dist/tree-sitter-description.wasm`.

To work on the grammar directly, from the parent package root (`packages/tree-sitter/`):

```bash
npm install
npm run generate-description   # compile grammar.js → src/parser.c
npm run test-description       # run test/corpus against the compiled parser
```

Or with the Tree-sitter CLI from inside this directory:

```bash
npx tree-sitter generate
npx tree-sitter test
npx tree-sitter parse path/to/file.description
npx tree-sitter highlight path/to/file.description
```

**Re-run `generate` after every edit to `grammar.js`.** `src/parser.c`, `src/grammar.json` and
`src/node-types.json` are generated output — a stale `parser.c` disagrees with the grammar silently, and
nothing warns an editor when it does.

## Requirements

Node.js 24 or newer, and `tree-sitter-cli` (a dev dependency of the parent package).

## Learn more

The language this grammar parses is specified in
[`dsl/reference/description.md`](../../../dsl/reference/description.md); the parsed tree reaches editors
through [`packages/language-server`](../../language-server) and
[`apps/vscode-extension`](../../../apps/vscode-extension).

## License

Apache 2.0 — see [`LICENSE`](../LICENSE). `src/tree_sitter/*.h` are vendored from the Tree-sitter
project (MIT) — see [`NOTICE`](../NOTICE).
