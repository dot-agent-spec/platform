# .description template

```
agent my-agent
  domain example.com
  license Apache-2.0

description
  What this agent does in one or two sentences.

behavior agent.behavior
```

## Optional fields

```
agent my-agent
  domain example.com
  license Apache-2.0
  terms https://example.com/terms
  privacy https://example.com/privacy

description
  Extended description here.

persona SOUL.md

behavior agent.behavior
```

## Notes

- `agent <name>`: used in the bundle ID; one or more space-separated words, each matching
  `[a-zA-Z_][a-zA-Z0-9_-]*` (e.g. `agent Doctor`, `agent Mickey Mouse`, `agent my-agent`)
- `domain <domain>`: reverse-DNS style (example.com, dot-agent, com.company)
- `description` block: indented text, as many lines as needed
- `behavior <file>`: path to entry .behavior file, relative to agent root
- `persona <file>`: path to SOUL.md; optional, no default — omit the block for no persona
- Identity meta keys are exactly `domain`, `license`, `terms`, `privacy`. `version` is **not** one —
  `agent my-agent` + `version v1.0.0` is a syntax error (E004); the version comes from
  `dot-agent pack --version`
- Only one `behavior` declaration allowed per file
