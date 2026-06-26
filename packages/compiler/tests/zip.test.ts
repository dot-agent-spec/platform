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
import { mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { createZip, writeZip, readZip, extractFiles, validateMagicBytes } from '../src/zip.js'

let tmpDir: string

async function makeTmp() {
  tmpDir = await mkdtemp(join(tmpdir(), 'compiler-zip-test-'))
  return tmpDir
}

afterEach(async () => {
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true })
    tmpDir = ''
  }
})

describe('createZip / writeZip / readZip', () => {
  it('writes and reads back a ZIP file', async () => {
    const dir = await makeTmp()
    const outPath = join(dir, 'test.zip')

    const zip = createZip()
    zip.file('hello.txt', 'Hello, world!')
    zip.file('nested/data.json', '{"ok":true}')
    await writeZip(zip, outPath)

    const loaded = await readZip(outPath)
    const files = await extractFiles(loaded)

    expect(files.get('hello.txt')).toBe('Hello, world!')
    expect(files.get('nested/data.json')).toBe('{"ok":true}')
  })
})

describe('validateMagicBytes', () => {
  it('accepts a valid ZIP file', async () => {
    const dir = await makeTmp()
    const outPath = join(dir, 'valid.zip')
    const zip = createZip()
    zip.file('a.txt', 'content')
    await writeZip(zip, outPath)

    await expect(validateMagicBytes(outPath)).resolves.toBe(true)
  })

  it('throws on a non-ZIP file', async () => {
    const { writeFile } = await import('fs/promises')
    const dir = await makeTmp()
    const fakePath = join(dir, 'fake.zip')
    await writeFile(fakePath, 'this is not a zip file')

    await expect(validateMagicBytes(fakePath)).rejects.toThrow('invalid magic bytes')
  })
})

describe('extractFiles', () => {
  it('extracts all files by default', async () => {
    const dir = await makeTmp()
    const outPath = join(dir, 'test.zip')

    const zip = createZip()
    zip.file('a.txt', 'aaa')
    zip.file('b/c.txt', 'ccc')
    zip.file('b/d.txt', 'ddd')
    await writeZip(zip, outPath)

    const loaded = await readZip(outPath)
    const files = await extractFiles(loaded)

    expect(files.size).toBe(3)
    expect(files.get('a.txt')).toBe('aaa')
    expect(files.get('b/c.txt')).toBe('ccc')
    expect(files.get('b/d.txt')).toBe('ddd')
  })

  it('filters by prefix when filter list is provided', async () => {
    const dir = await makeTmp()
    const outPath = join(dir, 'test.zip')

    const zip = createZip()
    zip.file('agent.description', 'desc')
    zip.file('agent.behavior', 'beh')
    zip.file('.agent/aboutme.json', '{}')
    await writeZip(zip, outPath)

    const loaded = await readZip(outPath)
    const files = await extractFiles(loaded, ['.agent/'])

    expect(files.size).toBe(1)
    expect(files.has('.agent/aboutme.json')).toBe(true)
    expect(files.has('agent.description')).toBe(false)
  })

  it('skips directory entries', async () => {
    const dir = await makeTmp()
    const outPath = join(dir, 'test.zip')

    const zip = createZip()
    zip.folder('guides')
    zip.file('guides/intro.md', 'intro')
    await writeZip(zip, outPath)

    const loaded = await readZip(outPath)
    const files = await extractFiles(loaded)

    // Only the file entry, not the folder itself
    expect([...files.keys()]).not.toContain('guides/')
    expect(files.get('guides/intro.md')).toBe('intro')
  })
})
