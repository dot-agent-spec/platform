// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { startDevMcpServer } from '../src/commands/server-mcp.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

// Mock the commands
vi.mock('../src/commands/init.js', () => ({
  init: vi.fn().mockResolvedValue({ dir: '/mock/dir', files: ['file1'] }),
}))
vi.mock('../src/commands/pack.js', () => ({
  pack: vi.fn().mockResolvedValue({ path: '/mock/path.agent', id: 'agent-id', warnings: [] }),
}))
vi.mock('../src/commands/unpack.js', () => ({
  unpack: vi.fn().mockResolvedValue({ dir: '/mock/unpack-dir', id: 'agent-id', files: [] }),
}))
vi.mock('../src/commands/configure.js', () => ({
  configure: vi.fn().mockResolvedValue([{ dest: '/mock/skill/path', mcpConfigured: true }]),
}))
vi.mock('../src/config.js', () => ({
  loadMcpConfig: vi.fn().mockResolvedValue({}),
}))

// dot_agent_init/pack/unpack are the only tools whose handlers this file exercises; load_agent and
// the FSM-driving tools (send_intent, ...) get their own coverage in mcp-load-agent.test.ts against
// the real registration logic in mcp-run.ts, since they need a real AgentSession/bundle to be useful.
const registeredTools: Record<string, Function> = {}
const registeredResources: Record<string, Function> = {}

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
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
  }
})

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(),
}))

describe('server-mcp command', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key in registeredTools) delete registeredTools[key]
    for (const key in registeredResources) delete registeredResources[key]
  })

  it('starts a single server named dot-agent, registering both dev and runtime tools', async () => {
    await startDevMcpServer({ transport: 'stdio', port: 3000 })

    expect(McpServer).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'dot-agent' }),
      expect.anything(),
    )

    // dev (authoring) tools
    expect(registeredTools['dot_agent_init']).toBeDefined()
    expect(registeredTools['dot_agent_pack']).toBeDefined()
    expect(registeredTools['dot_agent_unpack']).toBeDefined()
    expect(registeredTools['dot_agent_configure']).toBeDefined()

    // runtime tools — present at boot, before any agent is loaded
    expect(registeredTools['load_agent']).toBeDefined()
    expect(registeredTools['send_intent']).toBeDefined()
    expect(registeredTools['send_event']).toBeDefined()
    expect(registeredTools['send_offtopic']).toBeDefined()
    expect(registeredTools['tick_prompt']).toBeDefined()
    expect(registeredTools['inject_memory']).toBeDefined()

    // runtime resources — also present at boot
    expect(registeredResources['howto']).toBeDefined()
    expect(registeredResources['state']).toBeDefined()
    expect(registeredResources['intents']).toBeDefined()
  })

  it('dev tool handlers invoke correct commands', async () => {
    await startDevMcpServer({ transport: 'stdio', port: 3000 })

    // Test dot_agent_init
    const initRes = await registeredTools['dot_agent_init']({ name: 'test', domain: 'example.com', dir: '/test' })
    expect(JSON.parse(initRes.content[0].text)).toEqual({ ok: true, dir: '/mock/dir', files: ['file1'] })

    // Test dot_agent_pack
    const packRes = await registeredTools['dot_agent_pack']({ dir: '/test' })
    expect(JSON.parse(packRes.content[0].text)).toEqual({ ok: true, path: '/mock/path.agent', id: 'agent-id', warnings: [] })

    // Test dot_agent_unpack
    const unpackRes = await registeredTools['dot_agent_unpack']({ file: '/test.agent' })
    expect(JSON.parse(unpackRes.content[0].text)).toEqual({ ok: true, dir: '/mock/unpack-dir', id: 'agent-id', files: [] })

    // Test dot_agent_configure. Outside a live Claude Code session (CLAUDECODE unset) it passes
    // straight through to configure() — see the dedicated CLAUDECODE-guard test below for the refusal
    // path this handler takes when it *is* set.
    const previousClaudeCode = process.env.CLAUDECODE
    delete process.env.CLAUDECODE
    try {
      const configureRes = await registeredTools['dot_agent_configure']({ claude: true })
      expect(JSON.parse(configureRes.content[0].text)).toEqual({ ok: true, results: [{ dest: '/mock/skill/path', mcpConfigured: true }] })
    } finally {
      if (previousClaudeCode !== undefined) process.env.CLAUDECODE = previousClaudeCode
    }
  })

  it('dot_agent_configure refuses the claude target from inside a live Claude Code session', async () => {
    await startDevMcpServer({ transport: 'stdio', port: 3000 })

    const previousClaudeCode = process.env.CLAUDECODE
    process.env.CLAUDECODE = '1'
    try {
      const configureRes = await registeredTools['dot_agent_configure']({ claude: true })
      const parsed = JSON.parse(configureRes.content[0].text)
      expect(parsed.ok).toBe(false)
      expect(parsed.reason).toMatch(/terminal/)

      // gemini/murici are unrestricted even inside a live session — only claude is guarded.
      const muriciRes = await registeredTools['dot_agent_configure']({ murici: true })
      expect(JSON.parse(muriciRes.content[0].text)).toEqual({ ok: true, results: [{ dest: '/mock/skill/path', mcpConfigured: true }] })
    } finally {
      if (previousClaudeCode !== undefined) {
        process.env.CLAUDECODE = previousClaudeCode
      } else {
        delete process.env.CLAUDECODE
      }
    }
  })

  it('runtime tools report no agent loaded before load_agent is called', async () => {
    await startDevMcpServer({ transport: 'stdio', port: 3000 })

    const result = await registeredTools['send_intent']({ intent: 'anything' })
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toMatch(/No agent loaded/)
  })

  it('runtime resources report no agent loaded before load_agent is called', async () => {
    await startDevMcpServer({ transport: 'stdio', port: 3000 })

    const result = await registeredResources['state']()
    expect(result.contents[0].text).toMatch(/No agent loaded/)
  })
})
