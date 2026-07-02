# dot-agent: overview and quick start

dot-agent agents are written in a text DSL — not JSON. JSON only shows up as the wire encoding
when an agent is driven over MCP; the source you author is `.description` + `.behavior` files.

## Anatomy of an agent

- `agent.description` — metadata: name, domain, capabilities, which `.behavior` file to load
- `agent.behavior` — the FSM: `state <name>`, `on intent "..."`, `transition to <state>`, plus
  statements like `goal`, `guide`, `teach`, `set`, `run script`
- `SOUL.md` (optional) — persona: voice, values, behavioral rules
- `guides/`, `knowledge/` (optional) — reference files pulled in via `teach`

## Minimal working example

`greeter.description`:
```
agent greeter
  domain example.com

description
  A minimal greeter agent.

behavior greeter.behavior
```

`greeter.behavior`:
```
state init
  guide "Send the intent 'hello' to begin."
  on intent "hello"
    transition to greeting
  on offtopic
    transition to init

state greeting
  guide "Hello! Send 'done' to finish."
  on intent "done"
    transition to init
  on offtopic
    transition to greeting
```

Run it: `dot-agent run ./greeter/` — loads, lints, prints the initial state. See `cli` →
`cli_walkthrough` for the same agent driven end to end over MCP.

## Where to go next

| Intent from `init` | Covers |
|---|---|
| `dsl` | `.behavior`/`.description` syntax: states, statements, memory, persona |
| `gen` | Authoring workflow: description → behavior → patterns → validate |
| `cli` | The CLI itself, MCP server mode, a worked MCP interaction transcript |
| `pack` | Packaging a project into a `.agent` bundle |
