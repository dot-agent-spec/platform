# Contributing to tree-sitter

---

## Grammar evolution workflow

```
1. Edit grammar.js (or behavior/grammar.js)
       ↓
2. npx tree-sitter generate      ← recompiles src/parser.c
       ↓
3. npx tree-sitter parse <file> --quiet   ← manual smoke test
       ↓
4. Update test/corpus/ if needed
       ↓
5. npx tree-sitter test          ← confirm all cases pass
```

For the `.behavior` grammar use the same steps from inside `behavior/`, or the npm scripts:

```bash
npm run generate-behavior
npm run test-behavior
```

**Always regenerate before committing.** Stale `src/parser.c` causes silent parse failures in editors.

---

## How to read the parse tree

Given this file:

```
agent Doctor
  domain health.example.com
  license MIT

requires Prontuario
```

Running `npx tree-sitter parse doctor.description` produces:

```
(manifest
  (statement
    (agent_decl
      name: (agent_name
        (identifier))         ← "Doctor"
      (agent_meta             ← "domain health.example.com"
        value: (bare_string
          (filename)))
      (agent_meta             ← "license MIT"
        value: (bare_string
          (identifier)))))
  (statement
    (requires_block
      (type_list
        (type_reference
          (type_ref
            (identifier)))))))  ← "Prontuario"
```

| Notation | Meaning |
|----------|---------|
| `(node_name ...)` | A tree node — corresponds to a grammar rule |
| `name: (...)` | Named field — defined with `field('name', ...)` in `grammar.js` |
| `(identifier)` | Leaf node — corresponds to an actual token in the file |
| `(ERROR ...)` | Portion that did not match any rule — syntax error |

Lines with `(ERROR ...)` are the equivalent of a syntax error. Running with `--quiet` shows only errors, which is useful for batch validation.

---

## Writing corpus tests

Tests live in `test/corpus/*.txt`. The format is:

```
================================================================================
test name
================================================================================

input to be parsed

--------------------------------------------------------------------------------

(expected tree)

```

Separators:
- `====` (80 `=`) → start of each test case
- `----` (80 `-`) → separates input from expected tree

Recommended workflow:

1. Write the input in the test file with an empty expected tree (just `---` and nothing below)
2. Run `npx tree-sitter parse <file>` to see the generated tree
3. Paste the tree into the test file below `---`
4. Run `npx tree-sitter test` to confirm it matches

To run a single case:

```bash
npx tree-sitter test --filter "test name"
```

---

## Syntax highlighting setup

### Terminal check

```bash
npx tree-sitter highlight path/to/file.description
```

Prints the file with ANSI colors. If it appears colorized, the highlight queries in `queries/highlights.scm` are working.

### Global Tree-sitter config

To enable terminal highlighting, Tree-sitter needs to know where to find the parser. Run once:

```bash
npx tree-sitter init-config
```

This creates `~/.config/tree-sitter/config.json`. Add the **parent directory** of this package:

```json
{
  "parser-directories": [
    "~/path/to/dsl"
  ]
}
```

Tree-sitter finds `tree-sitter-agent` inside that directory because `package.json` declares `"name": "tree-sitter"`.
