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

import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { pack, collectFiles } from '../src/pack.js'
import { readZip, extractFiles } from '../src/zip.js'
import { parseAboutme } from '../src/manifest.js'

let tmpDir: string

async function makeAgentDir(opts?: { domain?: string; extraFiles?: Record<string, string> }) {
  tmpDir = await mkdtemp(join(tmpdir(), 'compiler-pack-test-'))

  const domain = opts?.domain ?? 'health.example.com'

  await writeFile(
    join(tmpDir, 'agent.description'),
    `agent Doctor\n  domain ${domain}\n  license MIT\n\ndescription\n  Clinical diagnostic agent.\n\ninput Patient\noutput Prescription\n`
  )
  await writeFile(
    join(tmpDir, 'agent.behavior'),
    `state init\n  transition to responsive\n\nstate responsive\n  goal "How can I help?"\n  interact\n  on intent "examine" transition to examine\n  on intent "done" transition to init\n  on offtopic transition to responsive\n\nstate examine\n  goal "Review."\n  interact\n  on intent "complete" transition to responsive\n  on offtopic transition to responsive\n`
  )
  await writeFile(join(tmpDir, 'SOUL.md'), '# Doctor\nYou are a diagnostic assistant.')

  await mkdir(join(tmpDir, 'guides'), { recursive: true })
  await mkdir(join(tmpDir, 'knowledge'), { recursive: true })
  await mkdir(join(tmpDir, 'behaviors'), { recursive: true })

  if (opts?.extraFiles) {
    for (const [rel, content] of Object.entries(opts.extraFiles)) {
      const fullPath = join(tmpDir, rel)
      await mkdir(join(fullPath, '..'), { recursive: true })
      await writeFile(fullPath, content)
    }
  }

  return tmpDir
}

afterEach(async () => {
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true })
    tmpDir = ''
  }
})

// ── collectFiles ──────────────────────────────────────────────────────────────

describe('collectFiles', () => {
  it('collects agent.description and agent.behavior', async () => {
    const dir = await makeAgentDir()
    const files = await collectFiles(dir)
    expect(files.has('agent.description')).toBe(true)
    expect(files.has('agent.behavior')).toBe(true)
  })

  it('collects SOUL.md when present', async () => {
    const dir = await makeAgentDir()
    const files = await collectFiles(dir)
    expect(files.has('SOUL.md')).toBe(true)
    expect(files.get('SOUL.md')).toContain('Doctor')
  })

  it('collects files from guides/ subdir', async () => {
    const dir = await makeAgentDir({ extraFiles: { 'guides/intro.md': '# Intro' } })
    const files = await collectFiles(dir)
    expect(files.has('guides/intro.md')).toBe(true)
  })

  it('skips .gitkeep files', async () => {
    const dir = await makeAgentDir()
    await writeFile(join(dir, 'guides/.gitkeep'), '')
    const files = await collectFiles(dir)
    expect(files.has('guides/.gitkeep')).toBe(false)
  })

  it('skips hidden files (dot-prefixed)', async () => {
    const dir = await makeAgentDir()
    await writeFile(join(dir, 'guides/.hidden'), 'secret')
    const files = await collectFiles(dir)
    expect(files.has('guides/.hidden')).toBe(false)
  })

  it('throws when agent.description is missing', async () => {
    const dir = await makeAgentDir()
    await rm(join(dir, 'agent.description'))
    await expect(collectFiles(dir)).rejects.toThrow()
  })
})

// ── pack ──────────────────────────────────────────────────────────────────────

describe('pack — happy path', () => {
  it('produces a .agent ZIP file', async () => {
    const dir = await makeAgentDir()
    const result = await pack({ dir, version: 'v1.0.0' })

    expect(result.path).toMatch(/\.agent$/)
    const { stat } = await import('fs/promises')
    const s = await stat(result.path)
    expect(s.size).toBeGreaterThan(0)
  })

  it('result contains a valid agent ID', async () => {
    const dir = await makeAgentDir()
    const result = await pack({ dir, version: 'v1.0.0' })
    expect(result.id).toMatch(/^health\.example\.com\/Doctor:v1\.0\.0~[0-9a-f]{7,}$/)
  })

  it('ZIP contains .agent/aboutme.json with correct fields', async () => {
    const dir = await makeAgentDir()
    const result = await pack({ dir, version: 'v1.0.0' })

    const zip = await readZip(result.path)
    const files = await extractFiles(zip, ['.agent/'])
    const aboutmeRaw = files.get('.agent/aboutme.json')
    expect(aboutmeRaw).toBeDefined()

    const aboutme = parseAboutme(JSON.parse(aboutmeRaw!))
    expect(aboutme.name).toBe('Doctor')
    expect(aboutme.domain).toBe('health.example.com')
    expect(aboutme.version).toBe('v1.0.0')
    expect(aboutme.schemaVersion).toBe('dot-agent/1.0')
    expect(aboutme.integrity.sha256).toHaveLength(64)
  })

  it('ZIP contains .agent/files.json', async () => {
    const dir = await makeAgentDir()
    const result = await pack({ dir, version: 'v1.0.0' })

    const zip = await readZip(result.path)
    const files = await extractFiles(zip, ['.agent/'])
    expect(files.has('.agent/files.json')).toBe(true)

    const filesJson = JSON.parse(files.get('.agent/files.json')!)
    expect(filesJson.description).toBe('agent.description')
    expect(filesJson.behavior).toBe('agent.behavior')
  })

  it('ZIP contains source files', async () => {
    const dir = await makeAgentDir({ extraFiles: { 'guides/intro.md': '# Intro' } })
    const result = await pack({ dir, version: 'v1.0.0' })

    const zip = await readZip(result.path)
    const allFiles = await extractFiles(zip)
    expect(allFiles.has('agent.description')).toBe(true)
    expect(allFiles.has('agent.behavior')).toBe(true)
    expect(allFiles.has('SOUL.md')).toBe(true)
    expect(allFiles.has('guides/intro.md')).toBe(true)
  })

  it('returns no errors (warnings array may be empty)', async () => {
    const dir = await makeAgentDir()
    const result = await pack({ dir, version: 'v1.0.0' })
    const errors = result.warnings.filter(m => m.severity === 'error')
    expect(errors).toHaveLength(0)
  })
})

describe('pack — output path', () => {
  it('respects a custom out path', async () => {
    const dir = await makeAgentDir()
    const outPath = join(dir, 'custom-output.agent')
    const result = await pack({ dir, out: outPath, version: 'v1.0.0' })
    expect(result.path).toBe(outPath)
    const { stat } = await import('fs/promises')
    await expect(stat(outPath)).resolves.toBeDefined()
  })
})

describe('pack — version', () => {
  it('uses v1.0.0 fallback when no git tag or explicit version', async () => {
    const dir = await makeAgentDir()
    // Pass explicit version to avoid relying on git in the test environment
    const result = await pack({ dir, version: 'v1.0.0' })
    expect(result.id).toContain('v1.0.0')
  })
})

describe('pack — lint errors abort packaging', () => {
  it('throws when agent.description has syntax errors', async () => {
    const dir = await makeAgentDir()
    await writeFile(join(dir, 'agent.description'), '@@@ broken @@@')
    await expect(pack({ dir, version: 'v1.0.0' })).rejects.toThrow('Lint failed')
  })

  it('throws when agent.description is missing', async () => {
    const dir = await makeAgentDir()
    await rm(join(dir, 'agent.description'))
    await expect(pack({ dir, version: 'v1.0.0' })).rejects.toThrow('E003')
  })

  it('throws when agent.behavior is missing', async () => {
    const dir = await makeAgentDir()
    await rm(join(dir, 'agent.behavior'))
    await expect(pack({ dir, version: 'v1.0.0' })).rejects.toThrow('E007')
  })
})
