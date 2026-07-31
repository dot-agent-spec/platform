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

// Coverage for the Runtime holder + load_agent design (mcp-run.ts): tools/resources register once
// at boot against an empty box, report "no agent loaded" until load_agent fills it, and a second
// load_agent call replaces whatever was loaded before — see plugins/claude/AGENTS.md and
// project/tasks/dot-agent-claude-skill.md item 3 for why this exists (the always-on `dot-agent`
// server can't wait for an agent to be chosen before its tool list is fixed).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerRuntime, type Runtime } from '../src/commands/mcp-run.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { stat, readFile } from 'fs/promises'

const registeredTools: Record<string, Function> = {}
const registeredResources: Record<string, Function> = {}

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn().mockImplementation(function () {
    return {
      tool: vi.fn().mockImplementation((name: string, _desc: string, _schema: any, handler: Function) => {
        registeredTools[name] = handler
      }),
      resource: vi.fn().mockImplementation((name: string, _uri: unknown, _meta: unknown, handler: Function) => {
        registeredResources[name] = handler
      }),
      connect: vi.fn().mockResolvedValue(undefined),
    }
  }),
  ResourceTemplate: vi.fn(),
}))

vi.mock('fs/promises', () => ({
  stat: vi.fn(),
  readFile: vi.fn(),
}))

// Two fake agents so a second load_agent can be told apart from the first.
function fakeBundle(id: string) {
  return {
    id,
    aboutme: { id },
    files: { persona: undefined, guides: [], knowledge: [] },
  }
}

function fakeSession(state: string) {
  return {
    setEffectListener: vi.fn(),
    start: vi.fn(),
    getState: vi.fn().mockReturnValue(state),
    getValidIntents: vi.fn().mockReturnValue([]),
    sendIntent: vi.fn(),
  }
}

vi.mock('@dot-agent/sdk', () => ({
  loadAgent: vi.fn(async () => fakeBundle('from-file')),
  AgentSession: { create: vi.fn(async () => fakeSession('init')) },
}))

vi.mock('@dot-agent/compiler', () => ({
  bundleFromDir: vi.fn(async () => fakeBundle('from-dir')),
}))

describe('Runtime holder + load_agent', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    for (const key in registeredTools) delete registeredTools[key]
    for (const key in registeredResources) delete registeredResources[key]

    const rt: Runtime = {}
    const server = new McpServer({ name: 'dot-agent', version: '1.0.0' })
    registerRuntime(server as any, rt, { transport: 'stdio', port: 0, exposePersona: true, exposeKnowledge: true })
  })

  it('reports no agent loaded on every runtime tool before load_agent runs', async () => {
    const result = await registeredTools['send_intent']({ intent: 'go' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toMatch(/No agent loaded/)
  })

  it('reports no agent loaded on runtime resources before load_agent runs', async () => {
    const state = await registeredResources['state']()
    expect(state.contents[0].text).toMatch(/No agent loaded/)
  })

  it('loads an agent from a .agent file and makes the runtime tools work', async () => {
    vi.mocked(stat).mockResolvedValue({ isFile: () => true } as any)
    vi.mocked(readFile).mockResolvedValue(Buffer.from('fake .agent bytes'))

    const loadRes = await registeredTools['load_agent']({ source: '/path/to/fridge.agent' })
    const loaded = JSON.parse(loadRes.content[0].text)
    expect(loaded).toEqual({ ok: true, id: 'from-file', state: 'init' })

    const stateRes = await registeredResources['state']()
    expect(stateRes.contents[0].text).toBe('init')
  })

  it('loads an agent from a directory (no .agent extension)', async () => {
    vi.mocked(stat).mockResolvedValue({ isFile: () => false } as any)

    const loadRes = await registeredTools['load_agent']({ source: '/path/to/fridge-src' })
    const loaded = JSON.parse(loadRes.content[0].text)
    expect(loaded).toEqual({ ok: true, id: 'from-dir', state: 'init' })
  })

  it('a second load_agent call replaces the first loaded agent', async () => {
    vi.mocked(stat).mockResolvedValueOnce({ isFile: () => true } as any)
    vi.mocked(readFile).mockResolvedValueOnce(Buffer.from('first agent'))
    const first = JSON.parse((await registeredTools['load_agent']({ source: '/first.agent' })).content[0].text)
    expect(first.id).toBe('from-file')

    vi.mocked(stat).mockResolvedValueOnce({ isFile: () => false } as any)
    const second = JSON.parse((await registeredTools['load_agent']({ source: '/second-dir' })).content[0].text)
    expect(second.id).toBe('from-dir')

    // The manifest resource now reflects the second agent, not the first — the box was replaced,
    // not appended to.
    const manifest = await registeredResources['manifest']()
    expect(JSON.parse(manifest.contents[0].text).id).toBe('from-dir')
  })
})
