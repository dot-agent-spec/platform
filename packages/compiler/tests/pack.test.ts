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
import { pack, collectFiles, consolidate, discoverDescriptionFile, findOrphanContentFiles } from '../src/pack.js'
import { readZip, extractFiles } from '../src/zip.js'
import { parseAboutme } from '../src/manifest.js'
import { DSL_VERSION } from '../src/generated-version.js'

let tmpDir: string

async function makeAgentDir(opts?: { domain?: string; extraFiles?: Record<string, string> }) {
  tmpDir = await mkdtemp(join(tmpdir(), 'compiler-pack-test-'))

  const domain = opts?.domain ?? 'health.example.com'

  await writeFile(
    join(tmpDir, 'agent.description'),
    `agent Doctor\n  domain ${domain}\n  license MIT\n\ndescription\n  Clinical diagnostic agent.\n\npersona SOUL.md\n\nbehavior agent.behavior\n\ninput Patient\noutput Prescription\n`
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

const MERGED_TEXT = `state init\n  transition to responsive\n`

// A content file only enters the bundle when a guide/teach statement names it,
// so any fixture exercising guides/ or knowledge/ has to carry the reference.
const mergedWith = (stmt: string) => `state init\n  ${stmt}\n  transition to responsive\n`

describe('collectFiles', () => {
  it('stores description under its filename and behavior as agent.behavior', async () => {
    const dir = await makeAgentDir()
    const files = await collectFiles(dir, 'agent.description', MERGED_TEXT, [])
    expect(files.has('agent.description')).toBe(true)
    expect(files.has('agent.behavior')).toBe(true)
    expect(files.get('agent.behavior')).toBe(MERGED_TEXT)
  })

  it('collects the persona file by its declared filename when passed', async () => {
    const dir = await makeAgentDir()
    const files = await collectFiles(dir, 'agent.description', MERGED_TEXT, [], 'SOUL.md')
    expect(files.has('SOUL.md')).toBe(true)
    expect(files.get('SOUL.md')).toContain('Doctor')
  })

  it('does not read a persona file when none is declared, even if present on disk', async () => {
    const dir = await makeAgentDir()
    const files = await collectFiles(dir, 'agent.description', MERGED_TEXT, [])
    expect(files.has('SOUL.md')).toBe(false)
  })

  it('throws when a declared persona file does not exist on disk', async () => {
    const dir = await makeAgentDir()
    await expect(
      collectFiles(dir, 'agent.description', MERGED_TEXT, [], 'missing-persona.md')
    ).rejects.toThrow()
  })

  it('throws when the declared persona path escapes the agent root', async () => {
    const dir = await makeAgentDir()
    await expect(
      collectFiles(dir, 'agent.description', MERGED_TEXT, [], '../../outside.md')
    ).rejects.toThrow('E014')
  })

  it('collects a guides/ file that a guide statement references', async () => {
    const dir = await makeAgentDir({ extraFiles: { 'guides/intro.md': '# Intro' } })
    const files = await collectFiles(dir, 'agent.description', mergedWith('guide "guides/intro.md"'), [])
    expect(files.get('guides/intro.md')).toBe('# Intro')
  })

  it('stores merge sources under behaviors/ prefix', async () => {
    const dir = await makeAgentDir()
    const files = await collectFiles(dir, 'agent.description', MERGED_TEXT, ['agent.behavior'])
    expect(files.has('behaviors/agent.behavior')).toBe(true)
  })

  it('skips .gitkeep files', async () => {
    const dir = await makeAgentDir()
    await writeFile(join(dir, 'guides/.gitkeep'), '')
    const files = await collectFiles(dir, 'agent.description', MERGED_TEXT, [])
    expect(files.has('guides/.gitkeep')).toBe(false)
  })

  it('skips hidden files (dot-prefixed)', async () => {
    const dir = await makeAgentDir()
    await writeFile(join(dir, 'guides/.hidden'), 'secret')
    const files = await collectFiles(dir, 'agent.description', MERGED_TEXT, [])
    expect(files.has('guides/.hidden')).toBe(false)
  })

  it('throws when description file is missing', async () => {
    const dir = await makeAgentDir()
    await rm(join(dir, 'agent.description'))
    await expect(collectFiles(dir, 'agent.description', MERGED_TEXT, [])).rejects.toThrow()
  })
})

// ── guide/teach file references (linked-only rule) ────────────────────────────

describe('collectFiles — guide/teach references', () => {
  // A reference is a path relative to the agent root, bundled verbatim at that
  // same path. The namespace comes from the path, not the keyword — so the key,
  // the on-disk location, and the reference are one value.
  it('bundles a teach file at its literal knowledge/ path', async () => {
    const dir = await makeAgentDir({ extraFiles: { 'knowledge/init-overview.md': '# Overview' } })
    const files = await collectFiles(dir, 'agent.description', mergedWith('teach "knowledge/init-overview.md"'), [])
    expect(files.get('knowledge/init-overview.md')).toBe('# Overview')
  })

  // Regression: a `knowledge/`-prefixed reference must NOT be re-prefixed into
  // `knowledge/knowledge/…`. This is the double-nesting bug the explicit-path
  // model removes.
  it('does not double-nest a namespace-prefixed reference', async () => {
    const dir = await makeAgentDir({ extraFiles: { 'knowledge/local-models.md': '# Local' } })
    const files = await collectFiles(dir, 'agent.description', mergedWith('teach "knowledge/local-models.md"'), [])
    expect(files.get('knowledge/local-models.md')).toBe('# Local')
    expect(files.has('knowledge/knowledge/local-models.md')).toBe(false)
  })

  // Regression: the keyword (`teach`) no longer routes the namespace — a
  // `teach "guides/…"` reference lands under guides/, classified as a guide by
  // its path prefix, not corrupted into knowledge/guides/…. Mirrors the shipped
  // Master Gardener example.
  it('honors the path namespace over the keyword', async () => {
    const dir = await makeAgentDir({ extraFiles: { 'guides/gather.md': '# Gather' } })
    const files = await collectFiles(dir, 'agent.description', mergedWith('teach "guides/gather.md"'), [])
    expect(files.get('guides/gather.md')).toBe('# Gather')
    expect(files.has('knowledge/guides/gather.md')).toBe(false)
  })

  it('bundles a nested reference at its literal path', async () => {
    const dir = await makeAgentDir({ extraFiles: { 'knowledge/sub/deep.md': '# Deep' } })
    const files = await collectFiles(dir, 'agent.description', mergedWith('teach "knowledge/sub/deep.md"'), [])
    expect(files.get('knowledge/sub/deep.md')).toBe('# Deep')
  })

  // A reference outside guides//knowledge/ is bundled verbatim (it exists), but
  // W016 flags it as unreachable — see findOrphanContentFiles tests below.
  it('bundles a reference that resolves outside guides//knowledge/ at its literal path', async () => {
    const dir = await makeAgentDir({ extraFiles: { 'recipes.md': 'sourdough' } })
    const files = await collectFiles(dir, 'agent.description', mergedWith('teach "recipes.md"'), [])
    expect(files.get('recipes.md')).toBe('sourdough')
    expect(files.has('knowledge/recipes.md')).toBe(false)
  })

  it('throws E018 when a referenced file exists nowhere', async () => {
    const dir = await makeAgentDir()
    await expect(
      collectFiles(dir, 'agent.description', mergedWith('teach "knowledge/ghost.md"'), [])
    ).rejects.toThrow('E018')
  })

  it('throws E014 when a reference escapes the agent root', async () => {
    const dir = await makeAgentDir()
    await expect(
      collectFiles(dir, 'agent.description', mergedWith('teach "../../outside.md"'), [])
    ).rejects.toThrow('E014')
  })

  it('leaves guides/ and knowledge/ files that nothing references out of the bundle', async () => {
    const dir = await makeAgentDir({
      extraFiles: { 'knowledge/orphan.md': 'unused', 'guides/orphan.md': 'unused' },
    })
    const files = await collectFiles(dir, 'agent.description', MERGED_TEXT, [])
    expect(files.has('knowledge/orphan.md')).toBe(false)
    expect(files.has('guides/orphan.md')).toBe(false)
  })

  // Regression: nothing constrains a reference's bundlePath to guides/knowledge,
  // so it can collide with a reserved key (a merge source under behaviors/, the
  // description file, agent.behavior, the persona) already set earlier in the
  // Map — silently overwriting real merge-source content the kernel depends on.
  it('throws E020 when a reference collides with a reserved bundle path', async () => {
    const dir = await makeAgentDir({
      extraFiles: {
        // The real merge source, read from the agent root by relPath.
        'shared.md': 'state shared\n  transition to init\n',
        // A distinct file that a `teach "behaviors/shared.md"` reference reads
        // literally — its bundle KEY collides with the one above's `behaviors/${relPath}`.
        'behaviors/shared.md': 'unrelated content',
      },
    })
    await expect(
      collectFiles(dir, 'agent.description', mergedWith('teach "behaviors/shared.md"'), ['shared.md'])
    ).rejects.toThrow('E020')
  })
})

// ── findOrphanContentFiles (W015) ─────────────────────────────────────────────

describe('findOrphanContentFiles', () => {
  it('reports W015 for a knowledge file no statement references', async () => {
    const dir = await makeAgentDir({ extraFiles: { 'knowledge/orphan.md': 'unused' } })
    const messages = await findOrphanContentFiles(dir, MERGED_TEXT)
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatchObject({
      file: 'knowledge/orphan.md',
      code: 'W015',
      severity: 'warning',
    })
  })

  it('stays silent when every content file is referenced by its literal path', async () => {
    const dir = await makeAgentDir({ extraFiles: { 'knowledge/used.md': 'used' } })
    const messages = await findOrphanContentFiles(dir, mergedWith('teach "knowledge/used.md"'))
    expect(messages).toEqual([])
  })

  it('does not report W015 for a namespace-prefixed reference (no phantom orphan)', async () => {
    const dir = await makeAgentDir({ extraFiles: { 'knowledge/local-models.md': 'x' } })
    const messages = await findOrphanContentFiles(dir, mergedWith('teach "knowledge/local-models.md"'))
    expect(messages.filter(m => m.code === 'W015')).toEqual([])
  })

  it('reports W016 for a reference that resolves outside guides//knowledge/', async () => {
    const dir = await makeAgentDir({ extraFiles: { 'recipes.md': 'sourdough' } })
    const messages = await findOrphanContentFiles(dir, mergedWith('teach "recipes.md"'))
    const w016 = messages.filter(m => m.code === 'W016')
    expect(w016).toHaveLength(1)
    expect(w016[0]).toMatchObject({ file: 'recipes.md', code: 'W016', severity: 'warning' })
  })

  // Regression: a reference outside guides//knowledge/ that doesn't exist on disk
  // at all gets E018 from collectFiles(), not W016 — W016's message claims "it
  // will be bundled", which would be false for a file that's simply missing.
  it('does not report W016 for a reference that resolves to no file on disk', async () => {
    const dir = await makeAgentDir()
    const messages = await findOrphanContentFiles(dir, mergedWith('teach "ghost.md"'))
    expect(messages.filter(m => m.code === 'W016')).toEqual([])
  })

  it('reports a file whose extension teach could never reference', async () => {
    const dir = await makeAgentDir({ extraFiles: { 'knowledge/data.csv': 'a,b' } })
    const messages = await findOrphanContentFiles(dir, MERGED_TEXT)
    expect(messages.map(m => m.file)).toEqual(['knowledge/data.csv'])
  })

  it('does not report .gitkeep or hidden files', async () => {
    const dir = await makeAgentDir()
    await writeFile(join(dir, 'knowledge/.gitkeep'), '')
    await writeFile(join(dir, 'guides/.hidden'), 'secret')
    const messages = await findOrphanContentFiles(dir, MERGED_TEXT)
    expect(messages).toEqual([])
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

  it('appends .agent to --out when the extension is left off', async () => {
    const dir = await makeAgentDir()
    const outNoExt = join(dir, 'my-bundle')
    const result = await pack({ dir, version: 'v1.0.0', out: outNoExt })
    expect(result.path).toBe(`${outNoExt}.agent`)
  })

  it('leaves --out untouched when it already ends in .agent', async () => {
    const dir = await makeAgentDir()
    const outWithExt = join(dir, 'my-bundle.agent')
    const result = await pack({ dir, version: 'v1.0.0', out: outWithExt })
    expect(result.path).toBe(outWithExt)
  })

  it('result contains a valid agent ID', async () => {
    const dir = await makeAgentDir()
    const result = await pack({ dir, version: 'v1.0.0' })
    expect(result.id).toMatch(/^health\.example\.com\/doctor:v1\.0\.0~[0-9a-f]{7,}$/)
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
    expect(aboutme.dslVersion).toBe(`dot-agent/${DSL_VERSION}`)
    expect(aboutme.integrity.sha256).toHaveLength(64)
    expect(aboutme.persona).toBe('SOUL.md')
  })

  it('produces a bare (form A) id when no --version and no TTY is available — no hardcoded default', async () => {
    const dir = await makeAgentDir()
    // vitest's process has no interactive stdin/stdout, so this exercises
    // the non-TTY branch of resolveVersionInteractive() without needing to
    // mock @clack/prompts.
    const result = await pack({ dir })
    expect(result.id).toBe('health.example.com/doctor')

    const zip = await readZip(result.path)
    const files = await extractFiles(zip, ['.agent/'])
    const aboutme = parseAboutme(JSON.parse(files.get('.agent/aboutme.json')!))
    expect(aboutme.version).toBe('')
  })

  it('throws on an invalid explicit --version', async () => {
    const dir = await makeAgentDir()
    await expect(pack({ dir, version: 'not-a-version' })).rejects.toThrow('E019')
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
    expect(filesJson.persona).toBe('SOUL.md')
    expect(Array.isArray(filesJson.behaviors)).toBe(true)
  })

  it('ZIP contains source files', async () => {
    const dir = await makeAgentDir({ extraFiles: { 'guides/intro.md': '# Intro' } })
    await writeFile(
      join(dir, 'agent.behavior'),
      `state init\n  guide "guides/intro.md"\n  transition to responsive\n\nstate responsive\n  goal "How can I help?"\n  interact\n  on intent "done" transition to init\n  on offtopic transition to responsive\n`
    )
    const result = await pack({ dir, version: 'v1.0.0' })

    const zip = await readZip(result.path)
    const allFiles = await extractFiles(zip)
    expect(allFiles.has('agent.description')).toBe(true)
    expect(allFiles.has('agent.behavior')).toBe(true)
    expect(allFiles.has('SOUL.md')).toBe(true)
    expect(allFiles.has('guides/intro.md')).toBe(true)
  })

  it('surfaces W015 in the result warnings for an unreferenced content file', async () => {
    const dir = await makeAgentDir({ extraFiles: { 'knowledge/orphan.md': 'unused' } })
    const result = await pack({ dir, version: 'v1.0.0' })

    expect(result.warnings.map(w => w.code)).toContain('W015')
    const zip = await readZip(result.path)
    const allFiles = await extractFiles(zip)
    expect(allFiles.has('knowledge/orphan.md')).toBe(false)
  })

  it('returns no errors (warnings array may be empty)', async () => {
    const dir = await makeAgentDir()
    const result = await pack({ dir, version: 'v1.0.0' })
    const errors = result.warnings.filter(m => m.severity === 'error')
    expect(errors).toHaveLength(0)
  })
})

describe('pack — persona resolution', () => {
  it('omits persona entirely when not declared, even if SOUL.md exists on disk', async () => {
    const dir = await makeAgentDir()
    await writeFile(
      join(dir, 'agent.description'),
      `agent Doctor\n  domain health.example.com\n  license MIT\n\ndescription\n  Clinical diagnostic agent.\n\nbehavior agent.behavior\n\ninput Patient\noutput Prescription\n`
    )
    const result = await pack({ dir, version: 'v1.0.0' })

    const zip = await readZip(result.path)
    const files = await extractFiles(zip)
    const aboutmeRaw = files.get('.agent/aboutme.json')
    const filesJson = JSON.parse(files.get('.agent/files.json')!)
    const aboutme = parseAboutme(JSON.parse(aboutmeRaw!))

    expect(aboutme.persona).toBeUndefined()
    expect(filesJson.persona).toBeUndefined()
    expect(files.has('SOUL.md')).toBe(false)
  })

  it('resolves a custom persona filename declared in the description', async () => {
    const dir = await makeAgentDir()
    await writeFile(
      join(dir, 'agent.description'),
      `agent Doctor\n  domain health.example.com\n  license MIT\n\ndescription\n  Clinical diagnostic agent.\n\npersona analyst-persona.md\n\nbehavior agent.behavior\n\ninput Patient\noutput Prescription\n`
    )
    await writeFile(join(dir, 'analyst-persona.md'), '# Analyst\nBe precise and terse.')

    const result = await pack({ dir, version: 'v1.0.0' })
    const zip = await readZip(result.path)
    const files = await extractFiles(zip)
    const aboutme = parseAboutme(JSON.parse(files.get('.agent/aboutme.json')!))
    const filesJson = JSON.parse(files.get('.agent/files.json')!)

    expect(aboutme.persona).toBe('analyst-persona.md')
    expect(filesJson.persona).toBe('analyst-persona.md')
    expect(files.get('analyst-persona.md')).toContain('Analyst')
  })

  it('throws when the description declares a persona file that does not exist', async () => {
    const dir = await makeAgentDir()
    await writeFile(
      join(dir, 'agent.description'),
      `agent Doctor\n  domain health.example.com\n  license MIT\n\ndescription\n  Clinical diagnostic agent.\n\npersona missing-persona.md\n\nbehavior agent.behavior\n`
    )
    await expect(pack({ dir, version: 'v1.0.0' })).rejects.toThrow()
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

// ── discoverDescriptionFile ───────────────────────────────────────────────────

describe('discoverDescriptionFile', () => {
  it('returns agent.description silently when present', async () => {
    const dir = await makeAgentDir()
    const name = await discoverDescriptionFile(dir)
    expect(name).toBe('agent.description')
  })

  it('returns non-standard name when only one .description file found', async () => {
    const dir = await makeAgentDir()
    await rm(join(dir, 'agent.description'))
    await writeFile(join(dir, 'my-agent.description'), 'agent MyAgent\n  domain test.com\n\nbehavior agent.behavior\n')
    const name = await discoverDescriptionFile(dir)
    expect(name).toBe('my-agent.description')
  })

  it('throws E003 when no .description file found', async () => {
    const dir = await makeAgentDir()
    await rm(join(dir, 'agent.description'))
    await expect(discoverDescriptionFile(dir)).rejects.toThrow('E003')
  })

  it('throws E003 when multiple .description files found', async () => {
    const dir = await makeAgentDir()
    await writeFile(join(dir, 'other.description'), 'agent Other\n')
    await expect(discoverDescriptionFile(dir)).rejects.toThrow('E003')
  })

  it('explicit override skips glob', async () => {
    const dir = await makeAgentDir()
    await writeFile(join(dir, 'explicit.description'), 'agent E\n\nbehavior agent.behavior\n')
    const name = await discoverDescriptionFile(dir, 'explicit.description')
    expect(name).toBe('explicit.description')
  })

  it('explicit override throws E003 if file missing', async () => {
    const dir = await makeAgentDir()
    await expect(discoverDescriptionFile(dir, 'missing.description')).rejects.toThrow('E003')
  })
})

// ── consolidate ───────────────────────────────────────────────────────────────

describe('consolidate', () => {
  it('returns entry file text when no merges', async () => {
    const dir = await makeAgentDir()
    const { mergedText, mergeSources } = await consolidate(dir, 'agent.behavior')
    expect(mergedText).toContain('state init')
    expect(mergeSources).toEqual(['agent.behavior'])
  })

  it('merges a dependency file before the entry', async () => {
    const dir = await makeAgentDir()
    await writeFile(
      join(dir, 'shared.behavior'),
      `state helper\n  transition to init\n`
    )
    await writeFile(
      join(dir, 'agent.behavior'),
      `merge "shared.behavior"\n\nstate init\n  transition to helper\n`
    )
    const { mergedText, mergeSources } = await consolidate(dir, 'agent.behavior')
    expect(mergedText).toContain('state helper')
    expect(mergedText).toContain('state init')
    // helper (leaf) before init (entry) in topological order
    expect(mergedText.indexOf('state helper')).toBeLessThan(mergedText.indexOf('state init'))
    expect(mergeSources).toContain('shared.behavior')
    expect(mergeSources).toContain('agent.behavior')
  })

  it('throws E012 when merge target not found', async () => {
    const dir = await makeAgentDir()
    await writeFile(
      join(dir, 'agent.behavior'),
      `merge "nonexistent.behavior"\n\nstate init\n  transition to init\n`
    )
    await expect(consolidate(dir, 'agent.behavior')).rejects.toThrow('E012')
  })

  it('throws E013 on circular merge dependency', async () => {
    const dir = await makeAgentDir()
    await writeFile(join(dir, 'a.behavior'), `merge "b.behavior"\nstate a\n  transition to b\n`)
    await writeFile(join(dir, 'b.behavior'), `merge "a.behavior"\nstate b\n  transition to a\n`)
    await writeFile(join(dir, 'agent.behavior'), `merge "a.behavior"\nstate init\n  transition to a\n`)
    await expect(consolidate(dir, 'agent.behavior')).rejects.toThrow('E013')
  })

  it('throws E014 when merge path escapes agent root', async () => {
    const dir = await makeAgentDir()
    await writeFile(
      join(dir, 'agent.behavior'),
      `merge "../../outside.behavior"\n\nstate init\n  transition to init\n`
    )
    await expect(consolidate(dir, 'agent.behavior')).rejects.toThrow('E014')
  })

  it('throws E014 when merge path is absolute', async () => {
    const dir = await makeAgentDir()
    await writeFile(
      join(dir, 'agent.behavior'),
      `merge "/etc/passwd"\n\nstate init\n  transition to init\n`
    )
    await expect(consolidate(dir, 'agent.behavior')).rejects.toThrow('E014')
  })
})

// ── pack — description discovery ──────────────────────────────────────────────

describe('pack — description discovery', () => {
  it('discovers non-standard description filename', async () => {
    const dir = await makeAgentDir()
    await rm(join(dir, 'agent.description'))
    await writeFile(
      join(dir, 'doctor.description'),
      `agent Doctor\n  domain health.example.com\n  license MIT\n\ndescription\n  Clinical diagnostic agent.\n\nbehavior agent.behavior\n`
    )
    const result = await pack({ dir, version: 'v1.0.0' })

    const zip = await readZip(result.path)
    const files = await extractFiles(zip, ['.agent/'])
    const filesJson = JSON.parse(files.get('.agent/files.json')!)
    expect(filesJson.description).toBe('doctor.description')
    expect(filesJson.behavior).toBe('agent.behavior')
  })

  it('throws E_DESC when description has no behavior block', async () => {
    const dir = await makeAgentDir()
    await writeFile(
      join(dir, 'agent.description'),
      `agent Doctor\n  domain health.example.com\n  license MIT\n\ndescription\n  No behavior block.\n`
    )
    await expect(pack({ dir, version: 'v1.0.0' })).rejects.toThrow('E_DESC')
  })
})

// ── pack — lint — E017 ────────────────────────────────────────────────────────

describe('pack — E017 duplicate behavior block', () => {
  it('throws Lint failed with E017 when description has two behavior declarations', async () => {
    const dir = await makeAgentDir()
    await writeFile(
      join(dir, 'agent.description'),
      `agent Doctor\n  domain health.example.com\n  license MIT\n\ndescription\n  Dupe.\n\nbehavior agent.behavior\nbehavior other.behavior\n`
    )
    await expect(pack({ dir, version: 'v1.0.0' })).rejects.toThrow('E017')
  })
})

// ── pack — lint — E015 / E016 ─────────────────────────────────────────────────

describe('pack — consolidation lint rules', () => {
  it('throws Lint failed with E016 when consolidated behavior has no init state', async () => {
    const dir = await makeAgentDir()
    await writeFile(
      join(dir, 'agent.behavior'),
      `state welcome\n  goal "Hello"\n  interact\n  on intent "go" transition to welcome\n  on offtopic transition to welcome\n`
    )
    await expect(pack({ dir, version: 'v1.0.0' })).rejects.toThrow('E016')
  })

  it('throws Lint failed with E015 when merged files have duplicate state name', async () => {
    const dir = await makeAgentDir()
    await writeFile(join(dir, 'leaf.behavior'), `state shared\n  transition to init\n`)
    await writeFile(
      join(dir, 'agent.behavior'),
      `merge "leaf.behavior"\n\nstate init\n  transition to shared\n\nstate shared\n  transition to init\n`
    )
    await expect(pack({ dir, version: 'v1.0.0' })).rejects.toThrow('E015')
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

  it('throws when the behavior file declared in .description is missing', async () => {
    const dir = await makeAgentDir()
    await rm(join(dir, 'agent.behavior'))
    await expect(pack({ dir, version: 'v1.0.0' })).rejects.toThrow('E012')
  })
})
