# Validating an agent

## Run before packing

```
dot-agent run <dir>
```

This lints the .description and .behavior files, applies the same checks as `dot-agent pack`, and starts the agent session. If there are lint errors, the run is blocked. Warnings are printed to stderr but do not block.

## Common lint errors

| Code | Meaning | Fix |
|------|---------|-----|
| E003 | `agent` block missing `name` field | Add `agent my-name` as first line |
| E004 | Parse error in .behavior syntax | Check quotes, keywords, string chars |
| E012 | Capability declared but no matching intent handler | Add `on intent "capability-name"` or remove capability |
| E014 | Unknown field in .description block | Remove unrecognized keyword |
| E015 | Duplicate state name (across merged files) | Rename one of the states |
| E016 | No `init` state in behavior | Add `state init` |

## Common lint warnings

| Code | Meaning |
|------|---------|
| W008 | State has no intent handlers and no `on offtopic` |
| W009 | `interact` called but no intent handlers follow in same state |
| W013 | Unreachable state (no transitions point to it) |

## Typical validate workflow

```
dot-agent run ./my-agent-dir
# fix lint errors shown in output
dot-agent run ./my-agent-dir
# green -> proceed to pack
dot-agent pack ./my-agent-dir --out my-agent.agent
```
