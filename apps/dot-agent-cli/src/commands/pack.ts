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
import { join, basename, dirname } from 'path'
import { execSync } from 'child_process'
import { createHash } from 'crypto'
import JSZip from 'jszip'
import { PackOptions, PackResult, LintMessage } from '../types.js'
import { createLinter } from '../core/lint.js'
import { buildId } from '../core/id.js'
import { buildAboutme, aboutmeToJson } from '../core/envelope.js'
import { buildTypesJson } from '../core/types.js'
import { writeZip } from '../core/zip.js'

function gitDescribeTags(): string | null {
  try {
    return execSync('git describe --tags --abbrev=0', {
      stdio: 'pipe',
      encoding: 'utf-8',
    }).trim()
  } catch {
    return null
  }
}

function gitRevParseShort(): string | null {
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: 'pipe',
      encoding: 'utf-8',
    }).trim()
  } catch {
    return null
  }
}

async function resolveVersion(explicit?: string): Promise<string> {
  if (explicit) return explicit

  const gitTag = gitDescribeTags()
  if (gitTag) return gitTag

  return 'v1.0.0'
}

async function resolveCommit(explicit?: string): Promise<string | undefined> {
  if (explicit) return explicit
  return gitRevParseShort() || undefined
}

async function collectFiles(dir: string): Promise<Map<string, string>> {
  const files = new Map<string, string>()

  async function walk(subdir: string, prefix: string = '') {
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
          const content = await readFile(fullPath, 'utf-8')
          files.set(relativePath, content)
        }
      }
    } catch {
      // directory doesn't exist or can't be read
    }
  }

  const description = await readFile(join(dir, 'agent.description'), 'utf-8')
  files.set('agent.description', description)

  const behavior = await readFile(join(dir, 'agent.behavior'), 'utf-8')
  files.set('agent.behavior', behavior)

  try {
    const soul = await readFile(join(dir, 'SOUL.md'), 'utf-8')
    files.set('SOUL.md', soul)
  } catch {
    // optional
  }

  await walk(join(dir, 'behaviors'), 'behaviors')
  await walk(join(dir, 'guides'), 'guides')
  await walk(join(dir, 'knowledge'), 'knowledge')

  return files
}

function parseDescription(text: string): any {
  const domain = text.match(/domain\s+([^\n]+)/)?.[1] || ''
  const name = text.match(/agent\s+([^\n]+)/)?.[1] || ''
  const description = text.match(/description\s+(.+?)(?=\n\n|\n[a-z])/s)?.[1] || ''

  return {
    domain: domain.trim(),
    name: name.trim(),
    description: description.trim(),
    capabilities: [],
  }
}

export async function pack(options: PackOptions = {}): Promise<PackResult> {
  const dir = options.dir || process.cwd()
  const outPath = options.out || join(dir, `${basename(dir)}.agent`)

  // Read files
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

  // Lint
  const linter = await createLinter()
  const descriptionMessages = await linter.lintDescription(descriptionText)
  const behaviorMessages = await linter.lintBehavior(behaviorText)

  const allMessages = [...descriptionMessages, ...behaviorMessages]
  const errors = allMessages.filter(m => m.severity === 'error')
  const warnings = allMessages.filter(m => m.severity === 'warning')

  if (errors.length > 0) {
    throw new Error(`Lint failed: ${errors.map(e => `${e.file}:${e.line}:${e.col} ${e.code} ${e.message}`).join('\n')}`)
  }

  // Parse description
  const description = parseDescription(descriptionText)

  // Resolve version & commit
  const version = await resolveVersion(options.version)
  const commit = await resolveCommit(options.commit)

  // Collect all files
  const allFiles = await collectFiles(dir)

  // Build ID
  const contentForHash = Array.from(allFiles.values()).join('')
  const digest = createHash('sha256').update(contentForHash).digest('hex').substring(0, 8)
  const id = buildId({
    namespace: description.domain,
    name: description.name,
    version,
    digest,
  })

  // Build aboutme
  const aboutme = buildAboutme({
    id,
    name: description.name,
    description: description.description,
    version,
    domain: description.domain,
    license: 'Apache-2.0',
    persona: 'SOUL.md',
    compiler: 'dot-agent/1.0.0',
    commit,
    skills: [],
    requires: [],
    integrity: {
      sha256: createHash('sha256').update(contentForHash).digest('hex'),
      files: '.agent/files.json',
    },
  })

  // Build ZIP
  const zip = new JSZip()

  zip.folder('.agent')!.file('aboutme.json', aboutmeToJson(aboutme))

  // Build files.json
  const filesJson = {
    description: 'agent.description',
    behavior: 'agent.behavior',
    behaviors: Array.from(allFiles.keys())
      .filter(f => f.startsWith('behaviors/') && f !== 'behaviors/.gitkeep')
      .map(f => f),
    guides: Array.from(allFiles.keys())
      .filter(f => f.startsWith('guides/') && f !== 'guides/.gitkeep')
      .map(f => f),
    knowledge: Array.from(allFiles.keys())
      .filter(f => f.startsWith('knowledge/') && f !== 'knowledge/.gitkeep')
      .map(f => f),
  }

  zip.folder('.agent')!.file('files.json', JSON.stringify(filesJson, null, 2))

  // Add all files to ZIP root
  for (const [path, content] of allFiles) {
    if (path !== 'behaviors/.gitkeep' && path !== 'guides/.gitkeep' && path !== 'knowledge/.gitkeep') {
      zip.file(path, content)
    }
  }

  // Write ZIP
  await writeZip(zip, outPath)

  return {
    path: outPath,
    id,
    warnings,
  }
}
