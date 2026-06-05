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

import { mkdir, writeFile, stat } from 'fs/promises'
import { join, basename } from 'path'
import { InitOptions, InitResult } from '../types.js'

const AGENT_DESCRIPTION_TEMPLATE = (name: string, domain: string) => `agent ${name}
  domain ${domain}
  license Apache-2.0

description
  Describe what this agent does.

behavior agent.behavior

capabilities
  ActionName "Describe this capability"
`

const AGENT_BEHAVIOR_TEMPLATE = `state init
  transition to responsive

state responsive
  goal "Help the user with their task."
  interact
  on intent "start" transition to responsive
`

const SOUL_TEMPLATE = (name: string) => `# ${name} — Persona

## Voice and Tone

Describe the agent's voice, personality, and communication style.
`

const README_TEMPLATE = (name: string) => `# ${name}

Brief description of what this agent does.

## Usage

Example of how to use this agent.
`

const LICENSE = `Apache License
Version 2.0, January 2004

http://www.apache.org/licenses/

TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION
`

export async function init(options: InitOptions = {}): Promise<InitResult> {
  const dir = options.dir || process.cwd()
  const name = options.name || basename(dir)
  const domain = options.domain || 'example.com'

  try {
    await stat(dir)
  } catch {
    await mkdir(dir, { recursive: true })
  }

  const agentDescriptionPath = join(dir, 'agent.description')
  try {
    await stat(agentDescriptionPath)
    throw new Error(`agent.description already exists at ${agentDescriptionPath}`)
  } catch (err: any) {
    if (err.code !== 'ENOENT') throw err
  }

  const files: string[] = []

  await writeFile(agentDescriptionPath, AGENT_DESCRIPTION_TEMPLATE(name, domain))
  files.push('agent.description')

  await writeFile(join(dir, 'agent.behavior'), AGENT_BEHAVIOR_TEMPLATE)
  files.push('agent.behavior')

  await writeFile(join(dir, 'SOUL.md'), SOUL_TEMPLATE(name))
  files.push('SOUL.md')

  await writeFile(join(dir, 'README.md'), README_TEMPLATE(name))
  files.push('README.md')

  await writeFile(join(dir, 'LICENSE'), LICENSE)
  files.push('LICENSE')

  await mkdir(join(dir, 'behaviors'), { recursive: true })
  await writeFile(join(dir, 'behaviors', '.gitkeep'), '')
  files.push('behaviors/.gitkeep')

  await mkdir(join(dir, 'guides'), { recursive: true })
  await writeFile(join(dir, 'guides', '.gitkeep'), '')
  files.push('guides/.gitkeep')

  await mkdir(join(dir, 'knowledge'), { recursive: true })
  await writeFile(join(dir, 'knowledge', '.gitkeep'), '')
  files.push('knowledge/.gitkeep')

  await writeFile(join(dir, 'AGENTS.md'), '')
  files.push('AGENTS.md')

  return { dir, files }
}
