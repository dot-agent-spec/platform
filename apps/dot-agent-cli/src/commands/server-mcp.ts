// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

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
import { version } from '../version.js'

export interface DevMcpServerOptions {
  transport: 'stdio' | 'http'
  port: number
}

export async function startDevMcpServer(opts: DevMcpServerOptions): Promise<void> {
  const mcp = new McpServer(
    { name: 'dot-agent-dev', version },
    { instructions: 'Development utilities for dot-agent: scaffolding, linting, packaging, and setup.' }
  )

  // register tools
  mcp.tool('dot_agent_init', 'Scaffold a new agent project', {
    name: z.string().optional(),
    domain: z.string().optional(),
    dir: z.string().optional(),
  }, async ({ name, domain, dir }) => {
    const res = await init({ name, domain, dir })
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, ...res }) }] }
  })

  mcp.tool('dot_agent_pack', 'Validate and build a .agent file', {
    dir: z.string().optional(),
    out: z.string().optional(),
    commit: z.string().optional(),
    version: z.string().optional(),
  }, async ({ dir, out, commit, version }) => {
    const res = await pack({ dir, out, commit, version })
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, ...res }) }] }
  })

  mcp.tool('dot_agent_unpack', 'Extract .agent file to sources', {
    file: z.string(),
    out: z.string().optional(),
    force: z.boolean().optional(),
  }, async ({ file, out, force }) => {
    const res = await unpack({ file, out, force })
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, ...res }) }] }
  })

  mcp.tool('dot_agent_configure', 'Install skills or configure MCP server for client platforms', {
    claude: z.boolean().optional(),
    gemini: z.boolean().optional(),
    agy: z.boolean().optional(),
    skill: z.boolean().optional(),
    mcp: z.boolean().optional(),
  }, async ({ claude, gemini, agy, skill, mcp }) => {
    const res = await configure({ claude, gemini, agy, skill, mcp })
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, results: res }) }] }
  })

  // start server
  if (opts.transport === 'stdio') {
    const transport = new StdioServerTransport()
    await mcp.connect(transport)
    process.stderr.write(`[dot-agent-dev] MCP server ready (stdio)\n`)
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
          onsessioninitialized: sid => sessions.set(sid, transport!),
        })
        transport.onclose = () => {
          if (transport!.sessionId) sessions.delete(transport!.sessionId)
        }
        const perConn = new McpServer(
          { name: 'dot-agent-dev', version },
          { instructions: 'Development utilities for dot-agent: scaffolding, linting, packaging, and setup.' }
        )
        // register same tools
        perConn.tool('dot_agent_init', 'Scaffold a new agent project', {
          name: z.string().optional(),
          domain: z.string().optional(),
          dir: z.string().optional(),
        }, async ({ name, domain, dir }) => {
          const res = await init({ name, domain, dir })
          return { content: [{ type: 'text', text: JSON.stringify({ ok: true, ...res }) }] }
        })

        perConn.tool('dot_agent_pack', 'Validate and build a .agent file', {
          dir: z.string().optional(),
          out: z.string().optional(),
          commit: z.string().optional(),
          version: z.string().optional(),
        }, async ({ dir, out, commit, version }) => {
          const res = await pack({ dir, out, commit, version })
          return { content: [{ type: 'text', text: JSON.stringify({ ok: true, ...res }) }] }
        })

        perConn.tool('dot_agent_unpack', 'Extract .agent file to sources', {
          file: z.string(),
          out: z.string().optional(),
          force: z.boolean().optional(),
        }, async ({ file, out, force }) => {
          const res = await unpack({ file, out, force })
          return { content: [{ type: 'text', text: JSON.stringify({ ok: true, ...res }) }] }
        })

        perConn.tool('dot_agent_configure', 'Install skills or configure MCP server for client platforms', {
          claude: z.boolean().optional(),
          gemini: z.boolean().optional(),
          agy: z.boolean().optional(),
          skill: z.boolean().optional(),
          mcp: z.boolean().optional(),
        }, async ({ claude, gemini, agy, skill, mcp }) => {
          const res = await configure({ claude, gemini, agy, skill, mcp })
          return { content: [{ type: 'text', text: JSON.stringify({ ok: true, results: res }) }] }
        })

        await perConn.connect(transport)
      }

      await transport.handleRequest(req, res)
    })

    httpServer.listen(opts.port, '127.0.0.1', () => {
      process.stderr.write(`[dot-agent-dev] MCP server ready (http) on 127.0.0.1:${opts.port}\n`)
    })

    await new Promise<void>((_, reject) => httpServer.on('error', reject))
  }
}
