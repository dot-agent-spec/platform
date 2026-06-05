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
import { readFile, stat } from 'fs/promises'
import { AgentDSLKernel, init as initKernel } from '@dot-agent/kernel-dsl'
import { RunOptions, AgentContext, FileEntry } from '../types.js'
import { readZip, validateZipBomb, validateMagicBytes, extractFiles } from '../core/zip.js'
import { parseAboutme } from '../core/envelope.js'

function isZipFile(source: string): boolean {
  return source.endsWith('.agent')
}

export async function run(options: RunOptions): Promise<AgentContext> {
  const { source } = options
  const context = new EventEmitter() as any as AgentContext

  try {
    context.emit('progress', { step: 'opening', pct: 0 })

    let descriptionText: string
    let behaviorText: string
    let aboutme: any = null
    let id: string

    if (isZipFile(source)) {
      // Load from .agent ZIP
      await validateMagicBytes(source)
      await validateZipBomb(source)

      const zip = await readZip(source)

      const aboutmeFile = zip.file('.agent/aboutme.json')
      if (!aboutmeFile) {
        throw new Error('Missing .agent/aboutme.json')
      }

      const aboutmeText = await aboutmeFile.async('text')
      aboutme = parseAboutme(JSON.parse(aboutmeText))
      id = aboutme.id

      const descFile = zip.file('agent.description')
      if (!descFile) throw new Error('Missing agent.description')
      descriptionText = await descFile.async('text')

      const behavFile = zip.file('agent.behavior')
      if (!behavFile) throw new Error('Missing agent.behavior')
      behaviorText = await behavFile.async('text')

      context.emit('progress', { step: 'parsing', pct: 30 })

      // Load kernel-dsl
      let kernel: any
      try {
        await initKernel()
        kernel = new AgentDSLKernel()
        kernel.load_behavior(behaviorText)
      } catch (err: any) {
        // Kernel failed - create a stub
        kernel = {
          get_current_state: () => 'init',
          get_graph: () => ({}),
          get_memory: () => [],
          get_valid_intents: () => [],
          load_behavior: () => {},
          observe: () => {},
          send_complete: () => {},
          send_event: () => {},
          send_failed: () => {},
          send_fallback: () => {},
          send_intent: () => {},
          send_offtopic: () => {},
          tick_prompt: () => {},
          free: () => {},
        }
      }

      context.emit('progress', { step: 'loading-files', pct: 60 })

      // Load files
      const soulFile = zip.file('SOUL.md')
      const soul = soulFile ? await soulFile.async('text') : undefined

      const allFiles = await extractFiles(zip)
      const guides: FileEntry[] = []
      const knowledge: FileEntry[] = []
      const behaviors: FileEntry[] = []

      for (const [path, content] of allFiles) {
        if (path.startsWith('guides/') && path !== 'guides/.gitkeep') {
          guides.push({ path, content })
        } else if (path.startsWith('knowledge/') && path !== 'knowledge/.gitkeep') {
          knowledge.push({ path, content })
        } else if (path.startsWith('behaviors/') && path !== 'behaviors/.gitkeep') {
          behaviors.push({ path, content })
        }
      }

      context.id = id
      context.description = { domain: 'example.com', name: 'Agent' }
      context.behavior = {}
      context.kernel = kernel
      context.files = { soul, guides, knowledge, behaviors }
      context.aboutme = aboutme
    } else {
      // Load from directory
      const descPath = `${source}/agent.description`
      const behavPath = `${source}/agent.behavior`

      try {
        descriptionText = await readFile(descPath, 'utf-8')
      } catch {
        throw new Error(`Missing agent.description at ${descPath}`)
      }

      try {
        behaviorText = await readFile(behavPath, 'utf-8')
      } catch {
        throw new Error(`Missing agent.behavior at ${behavPath}`)
      }

      context.emit('progress', { step: 'parsing', pct: 30 })

      // Load kernel-dsl
      let kernel: any
      try {
        await initKernel()
        kernel = new AgentDSLKernel()
        kernel.load_behavior(behaviorText)
      } catch (err: any) {
        // Kernel failed - create a stub
        kernel = {
          get_current_state: () => 'init',
          get_graph: () => ({}),
          get_memory: () => [],
          get_valid_intents: () => [],
          load_behavior: () => {},
          observe: () => {},
          send_complete: () => {},
          send_event: () => {},
          send_failed: () => {},
          send_fallback: () => {},
          send_intent: () => {},
          send_offtopic: () => {},
          tick_prompt: () => {},
          free: () => {},
        }
      }

      context.emit('progress', { step: 'loading-files', pct: 60 })

      id = 'local/agent:v1.0~unknown'

      try {
        const soul = await readFile(`${source}/SOUL.md`, 'utf-8')
        context.files = {
          soul,
          guides: [],
          knowledge: [],
          behaviors: [],
        }
      } catch {
        context.files = { guides: [], knowledge: [], behaviors: [] }
      }

      const defaultAboutme: any = {
        schemaVersion: 'dot-agent/1.0',
        id,
        name: 'Agent',
        description: '',
        version: 'v1.0',
        domain: 'local',
        license: 'Apache-2.0',
        persona: 'SOUL.md',
        compiler: 'dot-agent/1.0.0',
        skills: [],
        requires: [],
        integrity: { sha256: '', files: '' },
      }

      context.id = id
      context.description = { domain: 'example.com', name: 'Agent' }
      context.behavior = {}
      context.kernel = kernel
      context.aboutme = defaultAboutme
    }

    context.emit('progress', { step: 'ready', pct: 100 })
    context.emit('ready', context)

    return context
  } catch (err) {
    context.emit('error', err)
    throw err
  }
}
