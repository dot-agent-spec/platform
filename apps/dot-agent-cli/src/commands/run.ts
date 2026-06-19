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

import { EventEmitter } from 'events'
import { readFile } from 'fs/promises'
import { loadAgent, AgentSession, AgentBundle } from '@dot-agent/sdk'
import { collectFiles, parseDescriptionFile, initBehaviorParser } from '@dot-agent/compiler'
import { RunOptions, AgentContext, FileEntry } from '../types.js'

function isZipFile(source: string): boolean {
  return source.endsWith('.agent')
}

export async function run(options: RunOptions): Promise<AgentContext> {
  const { source } = options
  const context = new EventEmitter() as any as AgentContext

  try {
    context.emit('progress', { step: 'opening', pct: 0 })

    let bundle: AgentBundle

    if (isZipFile(source)) {
      const bytes = await readFile(source)
      context.emit('progress', { step: 'parsing', pct: 30 })
      bundle = await loadAgent(bytes)
    } else {
      context.emit('progress', { step: 'parsing', pct: 30 })
      const allFiles = await collectFiles(source)

      const descriptionText = allFiles.get('agent.description')
      if (!descriptionText) {
        throw new Error('E003: File agent.description not found')
      }

      const behaviorText = allFiles.get('agent.behavior')
      if (!behaviorText) {
        throw new Error('E007: File agent.behavior not found')
      }

      const soul = allFiles.get('SOUL.md')

      await initBehaviorParser()
      const descResult = parseDescriptionFile(descriptionText)
      if ('error' in descResult) {
        throw new Error(`E_DESC: ${descResult.error}`)
      }
      const df = descResult.ok

      const guides: FileEntry[] = []
      const knowledge: FileEntry[] = []
      const behaviors: FileEntry[] = []

      for (const [path, content] of allFiles.entries()) {
        if (path.startsWith('guides/') && path !== 'guides/.gitkeep') {
          guides.push({ path, content })
        } else if (path.startsWith('knowledge/') && path !== 'knowledge/.gitkeep') {
          knowledge.push({ path, content })
        } else if (path.startsWith('behaviors/') && path !== 'behaviors/.gitkeep') {
          behaviors.push({ path, content })
        }
      }

      const id = `local/${df.agent.name}:v1.0`
      const aboutme = {
        schemaVersion: 'dot-agent/1.0',
        id,
        name: df.agent.name,
        description: df.description ?? '',
        version: 'v1.0',
        domain: df.agent.domain ?? 'local',
        license: df.agent.license ?? 'Apache-2.0',
        persona: df.persona ?? 'SOUL.md',
        purpose: 'local development',
        compiler: 'dot-agent/1.0.0',
        skills: [],
        requires: df.requires,
        capabilities: df.capabilities.map(c => ({ id: c.name, description: c.description ?? '' })),
        integrity: {
          sha256: '',
          files: '.agent/files.json',
        },
      }

      bundle = {
        id,
        aboutme,
        files: {
          description: descriptionText,
          behavior: behaviorText,
          soul,
          guides,
          knowledge,
          behaviors,
        },
      }
    }

    context.emit('progress', { step: 'loading-files', pct: 60 })

    const session = await AgentSession.create(bundle)
    session.start()

    context.id = bundle.id
    context.description = bundle.files.description
    context.behavior = bundle.files.behavior
    context.kernel = (session as any).kernel
    context.aboutme = bundle.aboutme
    context.files = {
      soul: bundle.files.soul,
      guides: bundle.files.guides,
      knowledge: bundle.files.knowledge,
      behaviors: bundle.files.behaviors,
    }

    context.emit('progress', { step: 'ready', pct: 100 })
    context.emit('ready', context)

    return context
  } catch (err) {
    context.emit('error', err)
    throw err
  }
}
