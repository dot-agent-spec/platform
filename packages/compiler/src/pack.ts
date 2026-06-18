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

import { readFile, stat, readdir } from 'fs/promises'
import { join, basename } from 'path'
import { execSync } from 'child_process'
import { createHash } from 'crypto'
import JSZip from 'jszip'
import type { PackOptions, PackResult } from './types.js'
import { lintDescription, lintBehavior } from './linter.js'
import { buildId } from './id.js'
import { buildAboutme, aboutmeToJson } from './manifest.js'
import { writeZip } from './zip.js'

function gitDescribeTags(): string | null {
  try {
    return execSync('git describe --tags --abbrev=0', { stdio: 'pipe', encoding: 'utf-8' }).trim()
  } catch {
    return null
  }
}

function gitRevParseShort(): string | null {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: 'pipe', encoding: 'utf-8' }).trim()
  } catch {
    return null
  }
}

async function resolveVersion(explicit?: string): Promise<string> {
  if (explicit) return explicit
  return gitDescribeTags() ?? 'v1.0.0'
}

async function resolveCommit(explicit?: string): Promise<string | undefined> {
  if (explicit) return explicit
  return gitRevParseShort() ?? undefined
}

export async function collectFiles(dir: string): Promise<Map<string, string>> {
  const files = new Map<string, string>()

  async function walk(subdir: string, prefix = '') {
    try {
      const entries = await readdir(subdir)
      for (const entry of entries) {
        if (entry === '.gitkeep' || entry.startsWith('.')) continue
        const fullPath = join(subdir, entry)
        const stats = await stat(fullPath)
        const relativePath = prefix ? `${prefix}/${entry}` : entry
        if (stats.isDirectory()) {
          await walk(fullPath, relativePath)
        } else {
          files.set(relativePath, await readFile(fullPath, 'utf-8'))
        }
      }
    } catch {
      // directory doesn't exist or can't be read
    }
  }

  files.set('agent.description', await readFile(join(dir, 'agent.description'), 'utf-8'))
  files.set('agent.behavior', await readFile(join(dir, 'agent.behavior'), 'utf-8'))

  try {
    files.set('SOUL.md', await readFile(join(dir, 'SOUL.md'), 'utf-8'))
  } catch {
    // optional
  }

  await walk(join(dir, 'behaviors'), 'behaviors')
  await walk(join(dir, 'guides'), 'guides')
  await walk(join(dir, 'knowledge'), 'knowledge')

  return files
}

function parseDescriptionMeta(text: string): { domain: string; name: string; description: string } {
  return {
    domain: (text.match(/domain\s+([^\n]+)/)?.[1] ?? '').trim(),
    name: (text.match(/agent\s+([^\n]+)/)?.[1] ?? '').trim(),
    description: (text.match(/description\s+(.+?)(?=\n\n|\n[a-z])/s)?.[1] ?? '').trim(),
  }
}

export async function pack(options: PackOptions = {}): Promise<PackResult> {
  const dir = options.dir ?? process.cwd()
  const outPath = options.out ?? join(dir, `${basename(dir)}.agent`)

  let descriptionText: string
  let behaviorText: string

  try {
    descriptionText = await readFile(join(dir, 'agent.description'), 'utf-8')
  } catch {
    throw new Error('E003: File agent.description not found')
  }

  try {
    behaviorText = await readFile(join(dir, 'agent.behavior'), 'utf-8')
  } catch {
    throw new Error('E007: File agent.behavior not found')
  }

  const [descriptionMessages, behaviorMessages] = await Promise.all([
    lintDescription(descriptionText),
    lintBehavior(behaviorText),
  ])

  const allMessages = [...descriptionMessages, ...behaviorMessages]
  const errors = allMessages.filter(m => m.severity === 'error')
  const warnings = allMessages.filter(m => m.severity === 'warning')

  if (errors.length > 0) {
    throw new Error(
      `Lint failed:\n${errors.map(e => `  ${e.file}:${e.line}:${e.col} ${e.code} ${e.message}`).join('\n')}`
    )
  }

  const meta = parseDescriptionMeta(descriptionText)
  const version = await resolveVersion(options.version)
  const commit = await resolveCommit(options.commit)
  const allFiles = await collectFiles(dir)

  const contentForHash = Array.from(allFiles.values()).join('')
  const sha256 = createHash('sha256').update(contentForHash).digest('hex')

  const namespace = meta.domain || 'unknown'
  const id = buildId({ namespace, name: meta.name, version, digest: commit })

  const aboutme = buildAboutme({
    id,
    name: meta.name,
    description: meta.description,
    version,
    domain: meta.domain,
    license: 'Apache-2.0',
    persona: 'SOUL.md',
    compiler: 'dot-agent/1.0.0',
    commit,
    skills: [],
    requires: [],
    integrity: { sha256, files: '.agent/files.json' },
  })

  const zip = new JSZip()
  zip.folder('.agent')!.file('aboutme.json', aboutmeToJson(aboutme))

  const gitkeepPaths = new Set(['behaviors/.gitkeep', 'guides/.gitkeep', 'knowledge/.gitkeep'])
  const filesJson = {
    description: 'agent.description',
    behavior: 'agent.behavior',
    behaviors: Array.from(allFiles.keys()).filter(f => f.startsWith('behaviors/') && !gitkeepPaths.has(f)),
    guides: Array.from(allFiles.keys()).filter(f => f.startsWith('guides/') && !gitkeepPaths.has(f)),
    knowledge: Array.from(allFiles.keys()).filter(f => f.startsWith('knowledge/') && !gitkeepPaths.has(f)),
  }
  zip.folder('.agent')!.file('files.json', JSON.stringify(filesJson, null, 2))

  for (const [path, content] of allFiles) {
    if (!gitkeepPaths.has(path)) zip.file(path, content)
  }

  await writeZip(zip, outPath)

  return { path: outPath, id, warnings }
}
