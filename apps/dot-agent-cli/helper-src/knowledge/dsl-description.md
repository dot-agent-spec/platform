# .description file format

Minimal valid example:

```
agent my-agent
  domain example.com
  license Apache-2.0

description
  One-line description of what this agent does.

behavior agent.behavior
```

## Fields

| Field | Required | Notes |
|---|---|---|
| `agent <name>` | Yes | One or more space-separated words, each `[a-zA-Z_][a-zA-Z0-9_-]*` (e.g. `agent Doctor`, `agent Mickey Mouse`, `agent my-agent`) |
| `domain <domain>` | No (warned) | Missing domain packages as `unknown/name` and raises W007 |
| `description` block | No | Not linted |
| `behavior <file>` | Yes | Path to .behavior file relative to agent root — the only field that throws (`E_DESC`) |
| `license` | No | Apache-2.0 recommended |
| `terms <url>` / `privacy <url>` | No | Identity meta, parsed but not written to `aboutme.json` |
| `persona <file>` | No | Path to SOUL.md |

The only identity meta keys are `domain`, `license`, `terms`, `privacy`. There is **no `version`
field** — a bundle's version is set at pack time by `dot-agent pack --version`.

## Notes

- Only one `behavior` declaration is allowed (E017 if multiple)
- The behavior path must not escape the agent root (E014)
- If no `.description` file exists in the dir (or more than one does), pack fails with E003
