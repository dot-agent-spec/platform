// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest'
import { listAgents, getAgentPath } from '../src/commands/agents.js'

describe('agents command', () => {
  it('lists the bundled internal agents', async () => {
    const agents = await listAgents()
    expect(agents).toContainEqual(expect.objectContaining({ name: 'helper' }))
    for (const agent of agents) {
      expect(agent.path.endsWith(`${agent.name}.agent`)).toBe(true)
    }
  })

  it('resolves the path for a known agent', async () => {
    const path = await getAgentPath('helper')
    expect(path.endsWith('helper.agent')).toBe(true)
  })

  it('rejects with a clear message for an unknown agent', async () => {
    await expect(getAgentPath('does-not-exist')).rejects.toThrow(/Unknown internal agent 'does-not-exist'/)
  })
})
