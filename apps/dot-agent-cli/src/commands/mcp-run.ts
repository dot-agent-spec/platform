// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { readFile, stat } from 'fs/promises'
import { createServer } from 'http'
import { randomUUID } from 'node:crypto'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { loadAgent, AgentSession } from '@dot-agent/sdk'
import { bundleFromDir } from '@dot-agent/compiler'
import type { AgentBundle, ContentNamespace } from '@dot-agent/compiler'

export interface McpServerOptions {
  transport: 'stdio' | 'http'
  port: number
  exposePersona: boolean
  exposeKnowledge: boolean
}

// A mutable box, not a fixed reference: registerTools/registerResources close over this object
// once, at server-boot time, and read `.session`/`.bundle` fresh on every call — so `load_agent`
// can fill (or replace) the loaded agent after the tools are already registered and visible to the
// client. Without this indirection the tool list would only exist once an agent was already chosen,
// which is exactly the chicken-and-egg the always-on runtime server exists to avoid.
export interface Runtime {
  session?: AgentSession
  bundle?: AgentBundle
}

const HOWTO = `Navigate via dot-agent://intents + send_intent. Valid intents are state-dependent — re-read
dot-agent://intents after every transition, don't assume a prior intent still applies.
Effects come back from send_intent/send_event/send_offtopic as a JSON array. A "teach"/"guide"
effect gives a path relative to the agent root, already prefixed with its namespace (e.g.
"knowledge/local-models.md" or "guides/intro.md"); fetch its content via dot-agent://<that path
exactly as given> — do not prepend "knowledge/" or "guides/" again, the effect text already has
it. A "request_interact" effect means: pause and ask the human user for input, then match their
reply against the current dot-agent://intents list and call send_intent with the matched intent
name — never forward the raw reply text as the intent — or call send_offtopic if nothing
matches. Then continue. No agent is loaded until \`load_agent\` is called — a fresh session or a
second \`load_agent\` call both start (or restart) a flow from its initial state.`

const NO_AGENT_LOADED = 'No agent loaded — call load_agent(source) first.'

export async function loadBundleAndSession(source: string): Promise<{ bundle: AgentBundle; session: AgentSession }> {
  const srcStat = await stat(source)
  const bundle = srcStat.isFile()
    ? await loadAgent(await readFile(source))
    : await bundleFromDir(source)

  const session = await AgentSession.create(bundle)
  session.start()
  return { bundle, session }
}

function capture<T>(session: AgentSession, fn: () => void): unknown[] {
  const effects: unknown[] = []
  session.setEffectListener(e => effects.push(e))
  fn()
  session.setEffectListener(undefined)
  return effects
}

// Every tool handler in this file returns an explicit result rather than throwing — including on
// the "no agent loaded" path — so the response shape is identical whether the tool runs through the
// SDK's full dispatch or is invoked directly (as the test suite does against the raw callback).
function errorResult(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const }
}

function registerLoadTool(server: McpServer, rt: Runtime) {
  server.tool(
    'load_agent',
    'Load (or reload) a .agent file or agent project directory, starting its FSM from the initial state. Replaces whatever agent was previously loaded on this connection.',
    { source: z.string() },
    async ({ source }) => {
      const { bundle, session } = await loadBundleAndSession(source)
      rt.bundle = bundle
      rt.session = session
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true, id: bundle.id, state: session.getState() }) }] }
    }
  )
}

function registerTools(server: McpServer, rt: Runtime) {
  server.tool('send_intent', 'Send an intent to the agent FSM', { intent: z.string() }, async ({ intent }) => {
    if (!rt.session) return errorResult(NO_AGENT_LOADED)
    const effects = capture(rt.session, () => rt.session!.sendIntent(intent))
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, effects }) }] }
  })

  server.tool('send_event', 'Send an event to the agent FSM', { event: z.string() }, async ({ event }) => {
    if (!rt.session) return errorResult(NO_AGENT_LOADED)
    const effects = capture(rt.session, () => rt.session!.sendEvent(event))
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, effects }) }] }
  })

  server.tool('send_offtopic', 'Signal that user input does not match any intent', {}, async () => {
    if (!rt.session) return errorResult(NO_AGENT_LOADED)
    const effects = capture(rt.session, () => rt.session!.sendOfftopic())
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, effects }) }] }
  })

  server.tool('tick_prompt', 'Advance the prompt counter (for count-gated transitions)', {}, async () => {
    if (!rt.session) return errorResult(NO_AGENT_LOADED)
    const effects = capture(rt.session, () => rt.session!.tickPrompt())
    return { content: [{ type: 'text', text: JSON.stringify({ ok: true, effects }) }] }
  })

  server.tool(
    'inject_memory',
    'Inject a value into the agent memory store',
    { domain: z.enum(['context', 'session', 'worksession', 'user']), key: z.string(), value: z.string() },
    async ({ domain, key, value }) => {
      if (!rt.session) return errorResult(NO_AGENT_LOADED)
      rt.session.injectMemory(domain, key, value)
      return { content: [{ type: 'text', text: JSON.stringify({ ok: true }) }] }
    }
  )
}

// The `teach`/`guide` effect hands the host the reference verbatim — a path
// relative to the agent root, already namespace-prefixed, e.g.
// `knowledge/sub/deep.md`. The resource templates below use `{+name}` (RFC 6570
// reserved expansion), not plain `{name}` — a bare `{name}` compiles to a regex
// that excludes `/` (see @modelcontextprotocol/sdk's uriTemplate.js), so it could
// never match anything but a flat, single-segment file; `{+name}` is what lets a
// nested reference like `sub/deep.md` reach this handler at all. Once here, `name`
// is normally the part after the literal `guides/`/`knowledge/` in the template
// (e.g. `sub/deep.md`) — but a client that instead embeds the effect's full,
// already-prefixed text into `name` (e.g. `knowledge/sub/deep.md`) is also
// tolerated: strip a redundant leading `${ns}/` before matching, rather than an
// `endsWith` heuristic that could resolve the wrong file when two subdirectories
// share a basename. (The old fuzzy match existed only to paper over the packer's
// doubled `knowledge/knowledge/…` paths, now fixed at the source.)
function findContentFile(
  files: Array<{ path: string; content: string }>,
  ns: ContentNamespace,
  name: string,
): { path: string; content: string } | undefined {
  const rel = name.startsWith(`${ns}/`) ? name : `${ns}/${name}`
  return files.find(f => f.path === rel)
}

function registerResources(
  server: McpServer,
  rt: Runtime,
  opts: McpServerOptions,
) {
  const text = (body: string) => ({ contents: [{ uri: '', text: body, mimeType: 'text/plain' }] })
  const json = (body: unknown) => ({ contents: [{ uri: '', text: JSON.stringify(body, null, 2), mimeType: 'application/json' }] })
  const noAgent = () => text(NO_AGENT_LOADED)

  server.resource('howto', 'dot-agent://howto', { description: 'Minimal interaction primer' }, async () => text(HOWTO))
  server.resource('manifest', 'dot-agent://manifest', { description: 'Loaded agent aboutme.json' }, async () => (rt.bundle ? json(rt.bundle.aboutme) : noAgent()))
  server.resource('state', 'dot-agent://state', { description: 'Current FSM state name' }, async () => (rt.session ? text(rt.session.getState()) : noAgent()))
  server.resource('intents', 'dot-agent://intents', { description: 'Valid intents in current state' }, async () => (rt.session ? json(rt.session.getValidIntents()) : noAgent()))
  server.resource('graph', 'dot-agent://graph', { description: 'SCXML with active state annotated' }, async () => (rt.session ? text(rt.session.getGraph()) : noAgent()))
  server.resource('memory', 'dot-agent://memory', { description: 'Full memory store (4 domains)' }, async () => (rt.session ? json(rt.session.getMemory()) : noAgent()))

  if (opts.exposePersona) {
    server.resource('persona', 'dot-agent://persona', { description: 'Loaded agent persona' }, async () => {
      if (!rt.bundle) return noAgent()
      return rt.bundle.files.persona ? text(rt.bundle.files.persona) : text('This agent has no persona file.')
    })
  }

  server.resource(
    'guides',
    new ResourceTemplate('dot-agent://guides/{+name}', { list: undefined }),
    { description: 'Guide file content' },
    async (uri, { name }) => {
      if (!rt.bundle) return { contents: [{ uri: uri.href, ...noAgent().contents[0] }] }
      const guide = findContentFile(rt.bundle.files.guides, 'guides', String(name))
      if (!guide) return { contents: [{ uri: uri.href, text: `Guide '${name}' not found`, mimeType: 'text/plain' }] }
      return { contents: [{ uri: uri.href, text: guide.content, mimeType: 'text/plain' }] }
    }
  )

  if (opts.exposeKnowledge) {
    server.resource(
      'knowledge',
      new ResourceTemplate('dot-agent://knowledge/{+name}', { list: undefined }),
      { description: 'Knowledge file content' },
      async (uri, { name }) => {
        if (!rt.bundle) return { contents: [{ uri: uri.href, ...noAgent().contents[0] }] }
        const item = findContentFile(rt.bundle.files.knowledge, 'knowledge', String(name))
        if (!item) return { contents: [{ uri: uri.href, text: `Knowledge '${name}' not found`, mimeType: 'text/plain' }] }
        return { contents: [{ uri: uri.href, text: item.content, mimeType: 'text/plain' }] }
      }
    )
  }
}

// Registers the full runtime surface (load_agent + send_intent/... + dot-agent:// resources) on an
// already-created McpServer. Exported so a host that wants runtime tools alongside its own (e.g.
// server-mcp.ts's dev tools, on the same connection) can compose them rather than needing a second
// McpServer/process.
export function registerRuntime(server: McpServer, rt: Runtime, opts: McpServerOptions) {
  registerLoadTool(server, rt)
  registerTools(server, rt)
  registerResources(server, rt, opts)
}

const UNKNOWN_SESSION = Symbol('unknown-session')

// Routes a request to the transport for its Mcp-Session-Id. A request with no session id is
// treated as a fresh session bootstrap: the transport itself parses the body and rejects it with
// "Bad Request: Server not initialized" if it doesn't turn out to be an `initialize` call.
export async function getOrCreateTransport(
  sessions: Map<string, StreamableHTTPServerTransport>,
  sessionId: string | undefined,
  rt: Runtime,
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
  registerRuntime(perConn, rt, opts)
  await perConn.connect(transport)

  return transport
}

export async function startMcpServer(
  rt: Runtime,
  opts: McpServerOptions,
): Promise<void> {
  const mcp = new McpServer(
    { name: 'dot-agent', version: '1.0.0' },
    { instructions: HOWTO },
  )

  registerRuntime(mcp, rt, opts)

  if (opts.transport === 'stdio') {
    const transport = new StdioServerTransport()
    await mcp.connect(transport)
    process.stderr.write(`[dot-agent] MCP server ready (stdio)\n`)
    await new Promise<void>(() => {})  // block until process exit
  } else {
    const sessions = new Map<string, StreamableHTTPServerTransport>()

    const httpServer = createServer(async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined
      const transport = await getOrCreateTransport(sessions, sessionId, rt, opts)

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
