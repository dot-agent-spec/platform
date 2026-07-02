# The dot-agent CLI

| Command | Purpose |
|---|---|
| `dot-agent init` | Scaffold a new agent project |
| `dot-agent run <file.agent \| dir>` | Load and lint an agent, print its initial state |
| `dot-agent run <source> --mcp` | Load an agent and serve it over MCP for an LLM/client to drive |
| `dot-agent run --helper --mcp` | Serve this helper agent itself over MCP |
| `dot-agent pack --dir <dir> --out <file>` | Package a project into a `.agent` bundle — see the `pack` topic |
| `dot-agent unpack <file.agent>` | Extract a packed bundle back to source files |
| `dot-agent install-skill` | Install the Claude Code skill that bootstraps this helper |

## MCP server mode

`--mcp` starts an MCP server backed by a live FSM session. Any MCP client — an LLM, Claude Code,
a test harness — can drive it: read state and resources, send intents/events, inspect and inject
memory. Default transport is stdio; use `--mcp-transport http --mcp-port <n>` for HTTP.

Go to `cli_mcp` for the tools/resources/effects reference, or `cli_walkthrough` for a worked
example driving a loaded agent end to end.
