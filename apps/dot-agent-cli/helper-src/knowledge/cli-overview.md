# The dot-agent CLI

| Command | Purpose |
|---|---|
| `dot-agent init` | Scaffold a new agent project |
| `dot-agent run <file.agent \| dir>` | Load and lint an agent, print its initial state |
| `dot-agent run <source> --mcp` | Load an agent and serve it over MCP for an LLM/client to drive |
| `dot-agent run --helper --mcp` | Serve this helper agent itself over MCP |
| `dot-agent pack --dir <dir> --out <file>` | Package a project into a `.agent` bundle — see the `pack` topic |
| `dot-agent unpack <file.agent>` | Extract a packed bundle back to source files |
| `dot-agent configure --claude` (or `--gemini`/`--agy`, `--murici`) | Install the Claude Code (or Gemini/AGY, Murici) skill and register the `dot-agent`/`dot-agent-helper` MCP servers. `--skill`/`--mcp` narrow it to one half; with no target it prompts (TTY) or errors |
| `dot-agent server-mcp --mcp-transport stdio` | Serve the authoring tools (`dot_agent_init`/`_pack`/`_unpack`/`_configure`) *plus* the same runtime surface as `run --mcp` — this is the `dot-agent` server `configure` registers |
| `dot-agent agents list` / `dot-agent agents path <name>` | List locally known agents, or print one's path |

## MCP server mode

`--mcp` starts an MCP server backed by a live FSM session. Any MCP client — an LLM, Claude Code,
a test harness — can drive it: read state and resources, send intents/events, inspect and inject
memory. Default transport is stdio; use `--mcp-transport http --mcp-port <n>` for HTTP.

Go to `cli_mcp` for the tools/resources/effects reference, or `cli_walkthrough` for a worked
example driving a loaded agent end to end.
