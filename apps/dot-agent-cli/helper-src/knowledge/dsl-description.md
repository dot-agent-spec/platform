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
| `domain <domain>` | Yes | Reverse-DNS style |
| `description` block | Yes | Indented text block |
| `behavior <file>` | Yes | Path to .behavior file relative to agent root |
| `license` | No | Apache-2.0 recommended |
| `persona <file>` | No | Path to SOUL.md |
| `capabilities` block | No | List of named capabilities with descriptions |
| `requires` block | No | Dependencies on other agents or tools |

## Notes

- Only one `behavior` declaration is allowed (E017 if multiple)
- The behavior path must not escape the agent root (E014)
- If multiple .description files exist in the dir, pack fails with E003
