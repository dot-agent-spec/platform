# .description template

```
agent my-agent
  domain example.com
  license Apache-2.0

description
  What this agent does in one or two sentences.

behavior agent.behavior

capabilities
  chat "Engages in natural conversation"
  summarize "Summarizes provided text"
```

## Optional fields

```
agent my-agent
  domain example.com
  version v1.0.0
  license Apache-2.0

description
  Extended description here.

persona SOUL.md

behavior agent.behavior

capabilities
  respond "Answers user questions"

requires
  tool "web-search" "For looking up current information"
```

## Notes

- `agent <name>`: identifier used in the bundle ID, no spaces
- `domain <domain>`: reverse-DNS style (example.com, dot-agent, com.company)
- `description` block: indented text, as many lines as needed
- `behavior <file>`: path to entry .behavior file, relative to agent root
- `persona <file>`: path to SOUL.md, defaults to SOUL.md if omitted
- Only one `behavior` declaration allowed per file
