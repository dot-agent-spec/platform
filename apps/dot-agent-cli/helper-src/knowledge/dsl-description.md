# .description file format

Minimal valid example:

```
agent my-agent
  domain example.com
  license Apache-2.0

description
  One-line description of what this agent does.

behavior agent.behavior

capabilities
  chat "Engages in conversation"
```

## Fields

| Field | Required | Notes |
|---|---|---|
| `agent <name>` | Yes | Identifier, no spaces |
| `domain <domain>` | No (warned, not enforced) | Missing domain packages as `unknown/name` and raises W007 — not yet a hard error |
| `description` block | No (not yet validated) | Not currently linted at all; E001 for a missing required field is still "Planned" |
| `behavior <file>` | Yes | Path to .behavior file relative to agent root — the only field that actually throws today (`E_DESC`, pending promotion to a structured `E001`) |
| `license` | No | Apache-2.0 recommended |
| `persona <file>` | No | Path to SOUL.md |
| `capabilities` block | No | List of named capabilities with descriptions |
| `requires` block | No | Dependencies on other agents or tools |

## Notes

- Only one `behavior` declaration is allowed (E017 if multiple)
- The behavior path must not escape the agent root (E014)
- If no `.description` file exists in the dir (or more than one does), pack fails with E003
