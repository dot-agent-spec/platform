// SPDX-License-Identifier: Apache-2.0

// Regression suite for issue #21: `dot-agent init --help` scaffolded into process.cwd() and
// overwrote a real repository's LICENSE and README. The parser half is covered by
// tests/cli-args.test.ts; this file covers the second half — init() itself must refuse to
// overwrite any file the template would land on, whichever surface called it (the CLI, or the
// dot_agent_init MCP tool, which can omit `dir` just as easily).

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { init } from '../src/commands/init.js'

const SENTINEL = 'SENTINEL-DO-NOT-CLOBBER'

describe('init refuses to overwrite an existing file', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'dot-agent-init-guard-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('rejects when LICENSE already exists, and leaves it untouched', async () => {
    const license = join(dir, 'LICENSE')
    await writeFile(license, SENTINEL)

    await expect(init({ dir })).rejects.toThrow(/LICENSE/)
    expect(await readFile(license, 'utf-8')).toBe(SENTINEL)
  })

  it('rejects when README.md already exists, and leaves it untouched', async () => {
    const readme = join(dir, 'README.md')
    await writeFile(readme, SENTINEL)

    await expect(init({ dir })).rejects.toThrow(/README\.md/)
    expect(await readFile(readme, 'utf-8')).toBe(SENTINEL)
  })

  it('rejects when SOUL.md already exists, and leaves it untouched', async () => {
    const soul = join(dir, 'SOUL.md')
    await writeFile(soul, SENTINEL)

    await expect(init({ dir })).rejects.toThrow(/SOUL\.md/)
    expect(await readFile(soul, 'utf-8')).toBe(SENTINEL)
  })

  it('names every colliding path, not just the first one found', async () => {
    await writeFile(join(dir, 'LICENSE'), SENTINEL)
    await writeFile(join(dir, 'README.md'), SENTINEL)

    await expect(init({ dir })).rejects.toThrow(
      // one message mentioning both files
      expect.objectContaining({
        message: expect.stringMatching(/LICENSE[\s\S]*README\.md|README\.md[\s\S]*LICENSE/),
      })
    )
  })

  it('writes nothing at all when a single collision is found', async () => {
    await writeFile(join(dir, 'README.md'), SENTINEL)

    await expect(init({ dir })).rejects.toThrow()

    // The collision is discovered before the first byte is written, so no other template file
    // may have landed. Writing while walking is exactly what made the original incident partial.
    expect(existsSync(join(dir, 'agent.description'))).toBe(false)
    expect(existsSync(join(dir, 'agent.behavior'))).toBe(false)
    expect(existsSync(join(dir, 'SOUL.md'))).toBe(false)
    expect(existsSync(join(dir, 'LICENSE'))).toBe(false)
  })

  it('still rejects when only agent.description exists (the original guard, preserved)', async () => {
    const desc = join(dir, 'agent.description')
    await writeFile(desc, SENTINEL)

    await expect(init({ dir })).rejects.toThrow(/agent\.description/)
    expect(await readFile(desc, 'utf-8')).toBe(SENTINEL)
  })

  it('overwrites when force is set', async () => {
    const license = join(dir, 'LICENSE')
    await writeFile(license, SENTINEL)

    const result = await init({ dir, force: true })

    expect(result.dir).toBe(dir)
    const after = await readFile(license, 'utf-8')
    expect(after).not.toBe(SENTINEL)
    expect(after.length).toBeGreaterThan(SENTINEL.length)
  })

  it('still scaffolds the whole template into an empty directory', async () => {
    const result = await init({ dir, name: 'guard-agent', domain: 'test.com' })

    expect(result.dir).toBe(dir)
    expect(result.files.sort()).toEqual(
      [
        'LICENSE',
        'README.md',
        'SOUL.md',
        'agent.behavior',
        'agent.description',
        'behaviors/.gitkeep',
        'guides/.gitkeep',
        'knowledge/.gitkeep',
      ].sort()
    )
    for (const rel of result.files) {
      expect(existsSync(join(dir, rel))).toBe(true)
    }

    const desc = await readFile(join(dir, 'agent.description'), 'utf-8')
    expect(desc).toContain('agent guard-agent')
    expect(desc).toContain('domain test.com')
  })
})
