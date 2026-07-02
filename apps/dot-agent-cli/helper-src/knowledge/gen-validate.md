# Validating an agent

## Run before packing

```
dot-agent run <dir>
```

This lints the .description and .behavior files, applies the same checks as `dot-agent pack`, and starts the agent session. If there are lint errors, the run is blocked. Warnings are printed to stderr but do not block.

## Common lint errors

| Code | Meaning | Fix |
|------|---------|-----|
| E003 | `.description` file missing (or more than one found) | Add exactly one `*.description` file, or pass `PackOptions.description` to disambiguate |
| E004 | Parse error (tree-sitter `ERROR`/`MISSING` node) in .description or .behavior | Check quotes, keywords, `end` terminators — the message includes position and a grammar hint |
| E005 | `transition to <name>` targets an undeclared state | Fix the typo, or declare the target state (comes with an H002 hint on close matches) |
| E009 | Oriented state (`interact`) has zero `on intent` handlers | Add at least one `on intent "..."` |
| E012 | `merge "path"` target not found on disk | Fix the path or create the file |
| E014 | `merge` or `behavior <path>` escapes the agent root | Use a relative path that stays inside the agent directory |
| E016 | No `init` state in the consolidated behavior | Add `state init` |
| E017 | More than one `behavior` declaration in `.description` | Keep one `behavior` line; use `merge` inside `.behavior` to combine files |

## Common lint warnings

| Code | Meaning |
|------|---------|
| W001 | Isolated state — no incoming and no outgoing transitions |
| W006 | Dead-end `interact` — no `on intent`/`on offtopic` handlers, agent will trap |
| W008 | Duplicate `on intent "label"` in the same state — **error-severity despite the `W` prefix, blocks pack** |
| W009 | Unreachable state — nothing transitions to it and it isn't the entry state |
| W011 | `on intent` handler transitions back to its own enclosing state |
| W012 | `goal` in a state without `interact` — add `interact` or remove `goal` |
| W013 | `interact` without `goal` — add `goal "..."` before `interact` |

Full reference: `packages/compiler/docs/reference/lint-codes.md`.

## Typical validate workflow

```
dot-agent run ./my-agent-dir
# fix lint errors shown in output
dot-agent run ./my-agent-dir
# green -> proceed to pack
dot-agent pack --dir ./my-agent-dir --out my-agent.agent
```
