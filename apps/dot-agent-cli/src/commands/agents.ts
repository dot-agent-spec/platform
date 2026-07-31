// SPDX-License-Identifier: Apache-2.0

import { readdir, access } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

export interface AgentInfo {
  name: string
  path: string
}

// This module lives one directory deeper when run from TS source (src/commands/) than when
// bundled by tsdown (dist/) — try the bundled layout first, fall back to the source layout.
async function assetsDir(): Promise<string> {
  const here = dirname(fileURLToPath(import.meta.url))
  const bundled = join(here, '..', 'assets')
  try {
    await access(bundled)
    return bundled
  } catch {
    return join(here, '..', '..', 'assets')
  }
}

export async function listAgents(): Promise<AgentInfo[]> {
  const dir = await assetsDir()
  const entries = await readdir(dir)
  return entries
    .filter(f => f.endsWith('.agent'))
    .map(f => ({ name: f.replace(/\.agent$/, ''), path: join(dir, f) }))
}

export async function getAgentPath(name: string): Promise<string> {
  const agents = await listAgents()
  const found = agents.find(a => a.name === name)
  if (!found) {
    throw new Error(`Unknown internal agent '${name}'. Available: ${agents.map(a => a.name).join(', ') || '(none)'}`)
  }
  return found.path
}
