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
