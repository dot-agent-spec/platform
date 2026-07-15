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
