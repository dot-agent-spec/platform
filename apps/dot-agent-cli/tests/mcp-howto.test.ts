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
import { startMcpServer } from '../src/commands/mcp-run.js'
import type { AgentSession } from '@dot-agent/sdk'
import type { AgentBundle } from '@dot-agent/compiler'

const registeredResources: Record<string, Function> = {}

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: vi.fn().mockImplementation(function () {
      return {
        tool: vi.fn(),
        resource: vi.fn().mockImplementation((name: string, _uri: unknown, _meta: unknown, handler: Function) => {
          registeredResources[name] = handler
        }),
        connect: vi.fn().mockResolvedValue(undefined),
      }
    }),
    ResourceTemplate: vi.fn(),
  }
})

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}))

describe('dot-agent://howto resource', () => {
  beforeEach(() => {
    for (const key in registeredResources) {
      delete registeredResources[key]
    }
  })

  it('does not tell an already-connected client to reconnect via --helper, and documents teach resolution', async () => {
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

    // startMcpServer blocks forever on stdio (by design); don't await it.
    void startMcpServer(session, bundle, { transport: 'stdio', port: 0, exposePersona: false, exposeKnowledge: false })

    // Let the mocked connect() promise resolve and registerResources() run.
    await new Promise(resolve => setImmediate(resolve))

    expect(registeredResources['howto']).toBeDefined()
    const result = await registeredResources['howto']()
    const howtoText: string = result.contents[0].text

    expect(howtoText).not.toContain('--helper')
    // Documents that a teach/guide effect's text is already a namespace-prefixed
    // path (not a bare filename to be plugged into dot-agent://knowledge/{name}) —
    // see mcp-run.ts's HOWTO comment for why: {name} can't hold a nested path, and
    // re-prepending the namespace produces the doubled dot-agent://knowledge/knowledge/…
    // ambiguity findContentFile has to defensively strip.
    expect(howtoText).toContain('path relative to the agent root')
    expect(howtoText).toContain('dot-agent://')
  })
})
