# How to lint dot-agent sources

This guide shows how to call `lintDescription` and `lintBehavior` from Node.js and how to interpret the results.

---

## Basic usage

```ts
import { lintDescription, lintBehavior } from '@dot-agent/compiler'
import { readFile } from 'fs/promises'

const descSrc = await readFile('agent.description', 'utf-8')
const behSrc  = await readFile('agent.behavior',    'utf-8')

const descMsgs = await lintDescription(descSrc, 'agent.description')
const behMsgs  = await lintBehavior(behSrc,  'agent.behavior')

const all = [...descMsgs, ...behMsgs]

for (const msg of all) {
  const prefix = msg.severity === 'error' ? '✗' : '⚠'
  console.log(`${prefix} ${msg.file}:${msg.line}:${msg.col} ${msg.code} ${msg.message}`)
}

const hasErrors = all.some(m => m.severity === 'error')
process.exit(hasErrors ? 1 : 0)
```

---

## Reading a `LintMessage`

```ts
type LintMessage = {
  file:     string              // label passed to lint function, e.g. 'agent.behavior'
  line:     number              // 1-based line number
  col:      number              // 1-based column number
  severity: 'error' | 'warning'
  code:     string              // diagnostic code, e.g. 'E004' or 'W002'
  message:  string              // human-readable explanation
}
```

Errors (`E*` codes) mean the source is invalid and should not be packaged. Warnings (`W*` codes) are advisory — pack will still succeed.

See [`docs/reference/lint-codes.md`](../reference/lint-codes.md) for the full code table.

---

## Multi-file merge resolution

If a `.behavior` file uses `merge "other.behavior"` to import states from another file, the linter needs the absolute path of the source file to resolve relative `merge` paths. Pass it as `docPath`:

```ts
import { resolve } from 'path'

const behMsgs = await lintBehavior(
  behSrc,
  'agent.behavior',
  resolve('./agent.behavior')   // enables merge resolution
)
```

Without `docPath`, merged state names are not included when checking dangling transitions — transitions that target states defined only in merged files will be reported as `E005`.

### Post-consolidation checks

Three lint rules only fire on the **fully consolidated** behavior (all `merge` files resolved and concatenated). The language server does **not** trigger them — only `pack()` does, by passing `consolidated=true`:

| Code | Check |
|---|---|
| `E015` | Duplicate state name across merged files |
| `E016` | No `init` state in consolidated behavior (kernel would error at runtime) |
| `W014` | Duplicate global trigger (`on event "…"`) across merged files |

`pack()` sets `consolidated=true` automatically. If you call `lintBehavior` directly on pre-merge source files, these checks are suppressed (they would produce false positives on individual files).

---

## Using the `createLinter` helper

`createLinter()` returns the two lint functions bundled together, useful when injecting the compiler into a larger pipeline:

```ts
import { createLinter } from '@dot-agent/compiler'

const { lintDescription, lintBehavior } = await createLinter()
```

---

## Integrating with the pack pipeline

`pack()` runs lint internally and throws if any errors are found:

```ts
import { pack } from '@dot-agent/compiler'

try {
  const result = await pack({ dir: './my-agent', version: 'v1.0.0' })
  console.log('Packed:', result.id)
  if (result.warnings.length > 0) {
    result.warnings.forEach(w => console.warn(w.message))
  }
} catch (err) {
  // err.message starts with "Lint failed:" and lists all errors
  console.error(err.message)
  process.exit(1)
}
```

If you need to surface warnings from a successful pack, read `result.warnings` — it contains the full `LintMessage[]` for non-error diagnostics.
