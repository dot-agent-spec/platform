// SPDX-License-Identifier: Apache-2.0

import { createServer } from 'http'
import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { init } from './init.js'
import { pack } from './pack.js'
import { unpack } from './unpack.js'
import { configure } from './configure.js'
import { registerRuntime, type Runtime } from './mcp-run.js'
import { loadMcpConfig } from '../config.js'
import { version } from '../version.js'

export interface DevMcpServerOptions {
  transport: 'stdio' | 'http'
  port: number
}

const INSTRUCTIONS =
  'Authoring and running dot-agent projects: scaffolding, linting, packaging, setup, and — once ' +
  "load_agent is called — driving a loaded agent's FSM. No agent is loaded until load_agent runs."

// Authoring tools (init/pack/unpack/configure) are agent-agnostic — they don't touch the Runtime
// holder from mcp-run.ts, which only the runtime tools (load_agent, send_intent, ...) read.
function registerDevTools(server: McpServer) {
  server.tool('dot_agent_init', 'Scaffold a new agent project', {
    name: z.string().optional(),
    domain: z.string().optional(),
    dir: z.string().optional(),
  }, async ({ name, domain, dir }) => {
    const res = await init({ name, domain, dir })
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, ...res }) }] }
  })

  server.tool('dot_agent_pack', 'Validate and build a .agent file', {
    dir: z.string().optional(),
    out: z.string().optional(),
    commit: z.string().optional(),
    version: z.string().optional(),
  }, async ({ dir, out, commit, version }) => {
    const res = await pack({ dir, out, commit, version })
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, ...res }) }] }
  })

  server.tool('dot_agent_unpack', 'Extract .agent file to sources', {
    file: z.string(),
    out: z.string().optional(),
    force: z.boolean().optional(),
  }, async ({ file, out, force }) => {
    const res = await unpack({ file, out, force })
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, ...res }) }] }
  })

  server.tool(
    'dot_agent_configure',
    'Make a host ready to run .agent projects — installs the native plugin for hosts that have one ' +
      '(Claude Code) or writes the skill/MCP config directly for hosts that do not yet (gemini, murici)',
    {
      claude: z.boolean().optional(),
      gemini: z.boolean().optional(),
      agy: z.boolean().optional(),
      murici: z.boolean().optional(),
      skill: z.boolean().optional(),
      mcp: z.boolean().optional(),
    },
    async ({ claude, gemini, agy, murici, skill, mcp }) => {
      // This server is itself launched by the dot-agent plugin inside a running Claude Code session
      // (CLAUDECODE=1 is set there). Installing/reconfiguring that same plugin from a child of the live
      // session would contend with it over the plugin registry and ~/.claude.json (ADR-DA00-08) — refuse
      // and point at a terminal instead of the slash-command form, which doesn't work in every Claude
      // Code surface (e.g. the VS Code extension).
      if (claude && process.env.CLAUDECODE) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                ok: false,
                reason:
                  'Refusing to install the claude target from inside a running Claude Code session — ' +
                  'ask the user to run this in a terminal instead: `dot-agent configure --claude`, or ' +
                  'directly `claude plugin marketplace add dot-agent-spec/platform` then ' +
                  '`claude plugin install dot-agent@dot-agent-spec`.',
              }),
            },
          ],
        }
      }

      const res = await configure({ claude, gemini, agy, murici, skill, mcp })
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true, results: res }) }] }
    },
  )
}

export async function startDevMcpServer(opts: DevMcpServerOptions): Promise<void> {
  // Empty at boot — the load_agent tool that registerRuntime() adds below fills it.
  const rt: Runtime = {}
  const fileConfig = await loadMcpConfig()
  const runtimeOpts = {
    exposePersona: fileConfig.expose_persona ?? true,
    exposeKnowledge: fileConfig.expose_knowledge ?? true,
    transport: opts.transport,
    port: opts.port,
  }

  if (opts.transport === 'stdio') {
    const mcp = new McpServer({ name: 'dot-agent', version }, { instructions: INSTRUCTIONS })
    registerDevTools(mcp)
    // Same server, same connection: authoring tools and the full runtime surface
    // (load_agent/send_intent/tick_prompt/dot-agent://state/...) live together — see
    // plugins/claude/AGENTS.md for why dot-agent-dev was folded into this single `dot-agent` server.
    registerRuntime(mcp, rt, runtimeOpts)

    const transport = new StdioServerTransport()
    await mcp.connect(transport)
    process.stderr.write(`[dot-agent] MCP server ready (stdio)\n`)
    if (process.env.NODE_ENV !== 'test') {
      await new Promise<void>(() => {}) // block until process exit
    }
  } else {
    const sessions = new Map<string, StreamableHTTPServerTransport>()

    const httpServer = createServer(async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined
      let transport = sessionId ? sessions.get(sessionId) : undefined

      if (!transport) {
        if (sessionId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Bad Request: unknown Mcp-Session-Id' }, id: null }))
          return
        }

        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          // Store only once the SDK confirms initialization, avoiding a race where a second
          // request could arrive before the session id is known.
          onsessioninitialized: sid => { sessions.set(sid, transport!) },
        })
        transport.onclose = () => {
          if (transport!.sessionId) sessions.delete(transport!.sessionId)
        }
        const perConn = new McpServer({ name: 'dot-agent', version }, { instructions: INSTRUCTIONS })
        registerDevTools(perConn)
        registerRuntime(perConn, rt, runtimeOpts)
        await perConn.connect(transport)
      }

      await transport.handleRequest(req, res)
    })

    httpServer.listen(opts.port, '127.0.0.1', () => {
      process.stderr.write(`[dot-agent] MCP server ready (http) on 127.0.0.1:${opts.port}\n`)
    })

    await new Promise<void>((_, reject) => httpServer.on('error', reject))
  }
}
