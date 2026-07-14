// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { createServer } from 'http'
import { randomUUID } from 'node:crypto'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import type { AgentBundle } from '@dot-agent/compiler'
import type { AgentSession } from '@dot-agent/sdk'

export interface McpServerOptions {
  transport: 'stdio' | 'http'
  port: number
  exposePersona: boolean
  exposeKnowledge: boolean
}

const HOWTO = `Navigate via dot-agent://intents + send_intent. Valid intents are state-dependent — re-read
dot-agent://intents after every transition, don't assume a prior intent still applies.
Effects come back from send_intent/send_event/send_offtopic as a JSON array. A "teach" effect
gives a filename; fetch its content via dot-agent://knowledge/{name}. A "request_interact"
effect means: pause and ask the human user for input, then match their reply against the
current dot-agent://intents list and call send_intent with the matched intent name — never
forward the raw reply text as the intent — or call send_offtopic if nothing matches. Then
continue.`


function capture<T>(session: AgentSession, fn: () => void): unknown[] {
  const effects: unknown[] = []
  session.setEffectListener(e => effects.push(e))
  fn()
  session.setEffectListener(undefined)
  return effects
}

function registerTools(server: McpServer, session: AgentSession) {
  server.tool('send_intent', 'Send an intent to the agent FSM', { intent: z.string() }, async ({ intent }) => {
    const effects = capture(session, () => session.sendIntent(intent))
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, effects }) }] }
  })

  server.tool('send_event', 'Send an event to the agent FSM', { event: z.string() }, async ({ event }) => {
    const effects = capture(session, () => session.sendEvent(event))
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, effects }) }] }
  })

  server.tool('send_offtopic', 'Signal that user input does not match any intent', {}, async () => {
    const effects = capture(session, () => session.sendOfftopic())
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, effects }) }] }
  })

  server.tool('tick_prompt', 'Advance the prompt counter (for count-gated transitions)', {}, async () => {
    const effects = capture(session, () => session.tickPrompt())
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, effects }) }] }
  })

  server.tool(
    'inject_memory',
    'Inject a value into the agent memory store',
    { domain: z.enum(['context', 'session', 'worksession', 'user']), key: z.string(), value: z.string() },
    async ({ domain, key, value }) => {
      session.injectMemory(domain, key, value)
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] }
    }
  )
}

function registerResources(
  server: McpServer,
  session: AgentSession,
  bundle: AgentBundle,
  opts: McpServerOptions,
) {
  const text = (body: string) => ({ contents: [{ uri: '', text: body, mimeType: 'text/plain' }] })
  const json = (body: unknown) => ({ contents: [{ uri: '', text: JSON.stringify(body, null, 2), mimeType: 'application/json' }] })

  server.resource('howto', 'dot-agent://howto', { description: 'Minimal interaction primer' }, async () => text(HOWTO))
  server.resource('manifest', 'dot-agent://manifest', { description: 'Agent aboutme.json' }, async () => json(bundle.aboutme))
  server.resource('state', 'dot-agent://state', { description: 'Current FSM state name' }, async () => text(session.getState()))
  server.resource('intents', 'dot-agent://intents', { description: 'Valid intents in current state' }, async () => json(session.getValidIntents()))
  server.resource('graph', 'dot-agent://graph', { description: 'SCXML with active state annotated' }, async () => text(session.getGraph()))
  server.resource('memory', 'dot-agent://memory', { description: 'Full memory store (4 domains)' }, async () => json(session.getMemory()))

  if (opts.exposePersona && bundle.files.persona) {
    server.resource('persona', 'dot-agent://persona', { description: 'Agent persona' }, async () => text(bundle.files.persona!))
  }

  if (bundle.files.guides.length > 0) {
    server.resource(
      'guides',
      new ResourceTemplate('dot-agent://guides/{name}', { list: undefined }),
      { description: 'Guide file content' },
      async (uri, { name }) => {
        const guide = bundle.files.guides.find(g => g.path === `guides/${name}` || g.path.endsWith(`/${name}`))
        if (!guide) return { contents: [{ uri: uri.href, text: `Guide '${name}' not found`, mimeType: 'text/plain' }] }
        return { contents: [{ uri: uri.href, text: guide.content, mimeType: 'text/plain' }] }
      }
    )
  }

  if (opts.exposeKnowledge && bundle.files.knowledge.length > 0) {
    server.resource(
      'knowledge',
      new ResourceTemplate('dot-agent://knowledge/{name}', { list: undefined }),
      { description: 'Knowledge file content' },
      async (uri, { name }) => {
        const item = bundle.files.knowledge.find(k => k.path === `knowledge/${name}` || k.path.endsWith(`/${name}`))
        if (!item) return { contents: [{ uri: uri.href, text: `Knowledge '${name}' not found`, mimeType: 'text/plain' }] }
        return { contents: [{ uri: uri.href, text: item.content, mimeType: 'text/plain' }] }
      }
    )
  }
}

const UNKNOWN_SESSION = Symbol('unknown-session')

// Routes a request to the transport for its Mcp-Session-Id. A request with no session id is
// treated as a fresh session bootstrap: the transport itself parses the body and rejects it with
// "Bad Request: Server not initialized" if it doesn't turn out to be an `initialize` call.
export async function getOrCreateTransport(
  sessions: Map<string, StreamableHTTPServerTransport>,
  sessionId: string | undefined,
  session: AgentSession,
  bundle: AgentBundle,
  opts: McpServerOptions,
): Promise<StreamableHTTPServerTransport | typeof UNKNOWN_SESSION> {
  if (sessionId) {
    return sessions.get(sessionId) ?? UNKNOWN_SESSION
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    // Store only once the SDK confirms initialization, avoiding a race where a second request
    // could arrive before the session id is known.
    onsessioninitialized: sid => sessions.set(sid, transport),
  })
  transport.onclose = () => {
    if (transport.sessionId) sessions.delete(transport.sessionId)
  }

  const perConn = new McpServer({ name: 'dot-agent', version: '1.0.0' }, { instructions: HOWTO })
  registerTools(perConn, session)
  registerResources(perConn, session, bundle, opts)
  await perConn.connect(transport)

  return transport
}

export async function startMcpServer(
  session: AgentSession,
  bundle: AgentBundle,
  opts: McpServerOptions,
): Promise<void> {
  const mcp = new McpServer(
    { name: 'dot-agent', version: '1.0.0' },
    { instructions: HOWTO },
  )

  registerTools(mcp, session)
  registerResources(mcp, session, bundle, opts)

  if (opts.transport === 'stdio') {
    const transport = new StdioServerTransport()
    await mcp.connect(transport)
    process.stderr.write(`[dot-agent] MCP server ready (stdio)\n`)
    await new Promise<void>(() => {})  // block until process exit
  } else {
    const sessions = new Map<string, StreamableHTTPServerTransport>()

    const httpServer = createServer(async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined
      const transport = await getOrCreateTransport(sessions, sessionId, session, bundle, opts)

      if (transport === UNKNOWN_SESSION) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message: 'Bad Request: unknown Mcp-Session-Id' }, id: null }))
        return
      }

      await transport.handleRequest(req, res)
    })

    httpServer.listen(opts.port, '127.0.0.1', () => {
      process.stderr.write(`[dot-agent] MCP server ready (http) on 127.0.0.1:${opts.port}\n`)
      process.stderr.write(`[dot-agent] Debug mode: one shared FSM/memory instance for this process's lifetime — reconnecting clients resume where they left off, but concurrent distinct clients drive the same conversation. Not for multi-client isolation; restart the process for a clean state.\n`)
    })

    await new Promise<void>((_, reject) => httpServer.on('error', reject))
  }
}
