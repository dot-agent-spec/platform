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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getOrCreateTransport, type McpServerOptions } from '../src/commands/mcp-run.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { AgentSession } from '@dot-agent/sdk'
import type { AgentBundle } from '@dot-agent/compiler'

// Each mock instance records the options it was constructed with so a test can trigger the
// SDK's own onsessioninitialized/onclose callbacks the way the real transport would.
const transportInstances: any[] = []

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: vi.fn().mockImplementation(function (this: any, opts: any) {
    this._opts = opts
    this.sessionId = undefined
    this.onclose = undefined
    this.handleRequest = vi.fn().mockResolvedValue(undefined)
    transportInstances.push(this)
    return this
  }),
}))

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(function () {
    return {
      tool: vi.fn(),
      resource: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
    }
  }),
  ResourceTemplate: vi.fn(),
}))

const session = {
  setEffectListener: vi.fn(),
  getState: vi.fn().mockReturnValue('init'),
  getValidIntents: vi.fn().mockReturnValue([]),
  getGraph: vi.fn().mockReturnValue(''),
  getMemory: vi.fn().mockReturnValue({}),
} as unknown as AgentSession

const bundle = {
  aboutme: {},
  files: { persona: undefined, guides: [], knowledge: [] },
} as unknown as AgentBundle

const opts: McpServerOptions = { transport: 'http', port: 0, exposePersona: false, exposeKnowledge: false }

describe('getOrCreateTransport (HTTP session routing)', () => {
  beforeEach(() => {
    transportInstances.length = 0
    vi.mocked(StreamableHTTPServerTransport).mockClear()
  })

  it('reuses the transport for a known Mcp-Session-Id instead of creating a new one', async () => {
    const sessions = new Map<string, any>()

    const first = await getOrCreateTransport(sessions, undefined, session, bundle, opts)
    expect(transportInstances).toHaveLength(1)

    // The real SDK only stores the session once it confirms initialization; simulate that here.
    const onsessioninitialized = vi.mocked(StreamableHTTPServerTransport).mock.calls[0][0]!.onsessioninitialized!
    onsessioninitialized('session-123')
    expect(sessions.get('session-123')).toBe(first)

    const second = await getOrCreateTransport(sessions, 'session-123', session, bundle, opts)

    expect(second).toBe(first)
    expect(transportInstances).toHaveLength(1)
  })

  it('returns a non-transport sentinel for an unknown Mcp-Session-Id, without creating one', async () => {
    const sessions = new Map<string, any>()

    const result = await getOrCreateTransport(sessions, 'does-not-exist', session, bundle, opts)

    expect(typeof result).toBe('symbol')
    expect(transportInstances).toHaveLength(0)
  })

  it('removes the session from the map when the transport closes', async () => {
    const sessions = new Map<string, any>()

    const transport = await getOrCreateTransport(sessions, undefined, session, bundle, opts)
    const onsessioninitialized = vi.mocked(StreamableHTTPServerTransport).mock.calls[0][0]!.onsessioninitialized!
    onsessioninitialized('session-456')
    expect(sessions.has('session-456')).toBe(true)
    ;(transport as any).sessionId = 'session-456'

    ;(transport as any).onclose()

    expect(sessions.has('session-456')).toBe(false)
  })
})
