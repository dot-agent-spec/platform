// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect, afterEach } from 'vitest'
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import { readZip, writeZip } from '@dot-agent/compiler'
import { pack } from '../src/commands/pack.js'
import { unpack } from '../src/commands/unpack.js'

// Regression for platform#7: pack() stores every merge source — including
// the entry file itself — under `behaviors/<root-relative path>`
// (packages/compiler/src/pack.ts, collectFiles()) and separately flattens
// the merge graph into `agent.behavior` at the bundle root. The archived
// `.description` keeps declaring the entry at its ORIGINAL root-relative
// location (e.g. `behavior main.behavior`), so writing the archive's files
// verbatim on unpack left the entry at `behaviors/main.behavior`, which the
// description no longer names correctly — a subsequent `pack` failed with
// `E012`.
//
// unpack restores the ORIGINAL source layout instead: it parses the
// archived description to find the entry's declared path, walks the merge
// graph from there (mirroring consolidate()'s own resolution), and moves
// only the files that walk reaches back to their original root-relative
// location, stripping the `behaviors/` prefix pack.ts added. The
// description itself is never rewritten. Anything else stored under
// `behaviors/` — a `teach`/`guide` reference that happens to live there, for
// instance — is left exactly where the archive put it, because
// `.agent/files.json`'s `behaviors` array is not itself the merge graph: it
// lists every bundle key under the `behaviors/` prefix, which can include
// non-merge content. The flattened `agent.behavior` is only removed once a
// real, restorable source has been confirmed to replace it — an archive
// whose entry is genuinely named `agent.behavior` at the root restores the
// original (unflattened, merge-statement-intact) source there instead of
// losing it.

const MAIN = [
  'state init',
  '  transition to responsive',
  '',
  'state responsive',
  '  goal "Say hello"',
  '  guide "Greet the user."',
  '  interact',
  '  on intent "end" transition to goodbye',
  '  on offtopic transition to responsive',
  '',
  'state goodbye',
  '  goal "Conclude"',
  '  guide "Say goodbye."',
  '  interact',
  '  on intent "restart" transition to responsive',
  '  on offtopic transition to goodbye',
  '',
].join('\n')

function description(behaviorLine: string, prose = '  A minimal repro agent for issue 7'): string {
  return [
    'agent Repro',
    '  domain example.com',
    '  license Apache-2.0',
    '',
    'description',
    prose,
    '',
    behaviorLine,
    '',
    'input',
    '  string "input"',
    '',
    'output',
    '  string "output"',
    '',
  ].join('\n')
}

describe('unpack -> pack round trip', () => {
  const dirs: string[] = []

  afterEach(async () => {
    await Promise.all(dirs.splice(0).map(d => rm(d, { recursive: true, force: true })))
  })

  async function scratchDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), 'dot-agent-unpack-roundtrip-'))
    dirs.push(dir)
    return dir
  }

  interface Fixture {
    root: string
    srcDir: string
    unpackedDir: string
    firstArchive: string
    secondArchive: string
    unpackedDescription: string
  }

  // Packs `descText` with `files` (entry + any merge targets) alongside it,
  // unpacks the result, and re-packs the unpacked directory. Callers assert
  // on the returned fixture.
  async function roundTrip(descText: string, files: Record<string, string>): Promise<Fixture> {
    const root = await scratchDir()
    const srcDir = join(root, 'src-agent')
    await mkdir(srcDir, { recursive: true })
    await writeFile(join(srcDir, 'agent.description'), descText)
    for (const [relPath, content] of Object.entries(files)) {
      await mkdir(join(srcDir, dirname(relPath)), { recursive: true })
      await writeFile(join(srcDir, relPath), content)
    }

    const firstArchive = join(root, 'a1.agent')
    await pack({ dir: srcDir, out: firstArchive, version: '1.0.0' })

    const unpackedDir = join(root, 'u')
    await unpack({ file: firstArchive, out: unpackedDir })
    const unpackedDescription = await readFile(join(unpackedDir, 'agent.description'), 'utf-8')

    const secondArchive = join(root, 'a2.agent')
    await pack({ dir: unpackedDir, out: secondArchive, version: '1.0.0' })

    return { root, srcDir, unpackedDir, firstArchive, secondArchive, unpackedDescription }
  }

  async function readArchive(archive: string) {
    const zip = await readZip(archive)
    const behavior = await zip.file('agent.behavior')!.async('text')
    const aboutme = JSON.parse(await zip.file('.agent/aboutme.json')!.async('text'))
    const filesJson = JSON.parse(await zip.file('.agent/files.json')!.async('text'))
    return { behavior, aboutme, filesJson }
  }

  async function exists(path: string): Promise<boolean> {
    return readFile(path).then(() => true, () => false)
  }

  it.each([
    ['plain entry name', 'behavior main.behavior', { 'main.behavior': MAIN }, 'main.behavior'],
    ['quoted entry name', 'behavior "main.behavior"', { 'main.behavior': MAIN }, 'main.behavior'],
    ['trailing comment on the declaration', 'behavior main.behavior // entry point', { 'main.behavior': MAIN }, 'main.behavior'],
    ['quoted entry name with a space', 'behavior "my main.behavior"', { 'my main.behavior': MAIN }, 'my main.behavior'],
    ['quoted subdirectory entry', 'behavior "flows/main.behavior"', { 'flows/main.behavior': MAIN }, 'flows/main.behavior'],
    ['entry already named agent.behavior', 'behavior agent.behavior', { 'agent.behavior': MAIN }, 'agent.behavior'],
  ] as const)('re-packs cleanly and byte-for-byte for: %s', async (_label, behaviorLine, files, entryRelPath) => {
    const f = await roundTrip(description(behaviorLine), files)

    // The unpacked description is byte-identical to the archived one — this
    // fix never rewrites it.
    expect(f.unpackedDescription).toBe(description(behaviorLine))

    // The restore actually moved the file: the stale `behaviors/<entry>`
    // copy is gone (M2 — a mutation that skips deleting it after the move
    // would leave it behind), and since these fixtures have no merge target
    // or content reference left under `behaviors/`, the directory itself
    // shouldn't exist in the unpacked tree at all.
    expect(await exists(join(f.unpackedDir, 'behaviors', entryRelPath))).toBe(false)
    expect(await readdir(f.unpackedDir).then(names => names.includes('behaviors'), () => false)).toBe(false)

    // The flattened `agent.behavior` build artifact is gone once restoration
    // ran for an entry that isn't itself named `agent.behavior` (M1 — a
    // mutation that skips this delete would leave both the flattened copy
    // and the restored source sitting at the root together).
    if (entryRelPath !== 'agent.behavior') {
      expect(await exists(join(f.unpackedDir, 'agent.behavior'))).toBe(false)
    }

    const first = await readArchive(f.firstArchive)
    const second = await readArchive(f.secondArchive)
    expect(second.behavior).toBe(first.behavior)
    expect(second.filesJson.behaviors).toEqual(first.filesJson.behaviors)
    expect(second.aboutme.description).toBe(first.aboutme.description)
  })

  it('falls back to verbatim extraction (without throwing) when files.json names a description path that is not in the archive', async () => {
    const root = await scratchDir()
    const srcDir = join(root, 'src-agent')
    await mkdir(srcDir, { recursive: true })
    await writeFile(join(srcDir, 'agent.description'), description('behavior main.behavior'))
    await writeFile(join(srcDir, 'main.behavior'), MAIN)

    const firstArchive = join(root, 'a1.agent')
    await pack({ dir: srcDir, out: firstArchive, version: '1.0.0' })

    const zip = await readZip(firstArchive)
    const filesJson = JSON.parse(await zip.file('.agent/files.json')!.async('text'))
    filesJson.description = 'missing.description' // does not exist in the archive
    zip.file('.agent/files.json', JSON.stringify(filesJson))
    const badArchive = join(root, 'bad.agent')
    await writeZip(zip, badArchive)

    const unpackedDir = join(root, 'u')
    // Must not throw (M3 — a mutation that skips checking the description
    // path actually exists would hand `undefined` content to the
    // description parser and crash).
    await expect(unpack({ file: badArchive, out: unpackedDir })).resolves.toBeDefined()
    // No restoration happened: the entry is still under behaviors/, and the
    // real description (still at its real path) is untouched.
    expect(await readFile(join(unpackedDir, 'behaviors', 'main.behavior'), 'utf-8')).toBe(MAIN)
    expect(await readFile(join(unpackedDir, 'agent.description'), 'utf-8')).toBe(description('behavior main.behavior'))
  })

  it('handles a merge graph with a merge target of a merge target', async () => {
    const extra = [
      'merge "nested.behavior"',
      '',
      'state extra',
      '  goal "x"',
      '  guide "y"',
      '  interact',
      '  on intent "back" transition to responsive',
      '  on offtopic transition to responsive',
      '',
    ].join('\n')
    const nested = [
      'state nested',
      '  goal "n"',
      '  guide "m"',
      '  interact',
      '  on intent "back" transition to responsive',
      '  on offtopic transition to responsive',
      '',
    ].join('\n')

    const f = await roundTrip(description('behavior main.behavior'), {
      'main.behavior': 'merge "extra.behavior"\n\n' + MAIN,
      'extra.behavior': extra,
      'nested.behavior': nested,
    })

    expect(f.unpackedDescription).toBe(description('behavior main.behavior'))
    const first = await readArchive(f.firstArchive)
    const second = await readArchive(f.secondArchive)
    expect(second.behavior).toBe(first.behavior)
    expect(second.filesJson.behaviors).toEqual(first.filesJson.behaviors)
  })

  it('a prose line starting with the word "behavior" survives untouched', async () => {
    const f = await roundTrip(description('behavior main.behavior', '  behavior matters'), { 'main.behavior': MAIN })

    expect(f.unpackedDescription).toBe(description('behavior main.behavior', '  behavior matters'))
    const first = await readArchive(f.firstArchive)
    const second = await readArchive(f.secondArchive)
    expect(second.behavior).toBe(first.behavior)
    expect(second.aboutme.description).toBe(first.aboutme.description)
    expect(first.aboutme.description).toContain('behavior matters')
  })

  it('three consecutive round trips keep files.json.behaviors and agent.behavior stable', async () => {
    const root = await scratchDir()
    const srcDir = join(root, 'src-agent')
    await mkdir(srcDir, { recursive: true })
    await writeFile(join(srcDir, 'agent.description'), description('behavior main.behavior'))
    await writeFile(join(srcDir, 'main.behavior'), MAIN)

    const firstArchive = join(root, 'a0.agent')
    await pack({ dir: srcDir, out: firstArchive, version: '1.0.0' })
    const first = await readArchive(firstArchive)

    let currentSrc = srcDir
    for (let round = 1; round <= 3; round++) {
      const archive = join(root, `a${round}.agent`)
      await pack({ dir: currentSrc, out: archive, version: '1.0.0' })
      const roundResult = await readArchive(archive)

      expect(roundResult.filesJson.behaviors).toEqual(first.filesJson.behaviors)
      expect(roundResult.behavior).toBe(first.behavior)

      const unpackedDir = join(root, `u${round}`)
      await unpack({ file: archive, out: unpackedDir })
      const desc = await readFile(join(unpackedDir, 'agent.description'), 'utf-8')
      expect(desc).toBe(description('behavior main.behavior'))

      currentSrc = unpackedDir
    }
  })

  it('an edit to the restored entry file reaches the re-packed bundle', async () => {
    const root = await scratchDir()
    const srcDir = join(root, 'src-agent')
    await mkdir(srcDir, { recursive: true })
    await writeFile(join(srcDir, 'agent.description'), description('behavior main.behavior'))
    await writeFile(join(srcDir, 'main.behavior'), MAIN)

    const firstArchive = join(root, 'a1.agent')
    await pack({ dir: srcDir, out: firstArchive, version: '1.0.0' })

    const unpackedDir = join(root, 'u')
    await unpack({ file: firstArchive, out: unpackedDir })

    // The entry lands back at its ORIGINAL root-relative path, not under
    // behaviors/.
    const entryPath = join(unpackedDir, 'main.behavior')
    const original = await readFile(entryPath, 'utf-8')
    await writeFile(entryPath, original.replace('Say hello', 'EDITED GOAL'))

    const secondArchive = join(root, 'a2.agent')
    await pack({ dir: unpackedDir, out: secondArchive, version: '1.0.0' })
    const { behavior } = await readArchive(secondArchive)
    expect(behavior).toContain('EDITED GOAL')
  })

  it('leaves everything verbatim, and still extracts, when .agent/files.json is malformed', async () => {
    const root = await scratchDir()
    const srcDir = join(root, 'src-agent')
    await mkdir(srcDir, { recursive: true })
    const descText = description('behavior main.behavior')
    await writeFile(join(srcDir, 'agent.description'), descText)
    await writeFile(join(srcDir, 'main.behavior'), MAIN)

    const firstArchive = join(root, 'a1.agent')
    await pack({ dir: srcDir, out: firstArchive, version: '1.0.0' })

    const zip = await readZip(firstArchive)
    zip.file('.agent/files.json', '{ not json')
    const badArchive = join(root, 'bad.agent')
    await writeZip(zip, badArchive)

    const unpackedDir = join(root, 'u')
    await expect(unpack({ file: badArchive, out: unpackedDir })).resolves.toBeDefined()
    const unpackedDescription = await readFile(join(unpackedDir, 'agent.description'), 'utf-8')
    expect(unpackedDescription).toBe(descText)
    // Verbatim archive layout: entry stays under behaviors/, agent.behavior
    // (the flattened copy) is still present — no restoration happened.
    const entryStillNested = await readFile(join(unpackedDir, 'behaviors', 'main.behavior'), 'utf-8')
    expect(entryStillNested).toBe(MAIN)
    const flattened = await readFile(join(unpackedDir, 'agent.behavior'), 'utf-8')
    expect(flattened.length).toBeGreaterThan(0)
  })

  it('a teach reference stored under behaviors/ is not mistaken for a merge source', async () => {
    const root = await scratchDir()
    const srcDir = join(root, 'src-agent')
    await mkdir(srcDir, { recursive: true })
    await writeFile(join(srcDir, 'agent.description'), description('behavior main.behavior'))
    await writeFile(join(srcDir, 'main.behavior'), MAIN.replace('guide "Greet the user."', 'teach "behaviors/notes.md"'))
    await mkdir(join(srcDir, 'behaviors'), { recursive: true })
    await writeFile(join(srcDir, 'behaviors', 'notes.md'), '# notes\n')

    const firstArchive = join(root, 'a1.agent')
    await pack({ dir: srcDir, out: firstArchive, version: '1.0.0' })

    const unpackedDir = join(root, 'u')
    await unpack({ file: firstArchive, out: unpackedDir })

    // The entry is restored to root, the teach target stays under
    // behaviors/ exactly where it was archived — it's not a merge source.
    const entry = await readFile(join(unpackedDir, 'main.behavior'), 'utf-8')
    expect(entry).toContain('teach "behaviors/notes.md"')
    const notes = await readFile(join(unpackedDir, 'behaviors', 'notes.md'), 'utf-8')
    expect(notes).toBe('# notes\n')

    const secondArchive = join(root, 'a2.agent')
    await pack({ dir: unpackedDir, out: secondArchive, version: '1.0.0' })
    const first = await readArchive(firstArchive)
    const second = await readArchive(secondArchive)
    expect(second.behavior).toBe(first.behavior)
  })

  it('a hand-built archive whose root agent.behavior is already the real entry extracts verbatim and re-packs', async () => {
    const root = await scratchDir()
    // A genuine aboutme.json from a real pack, reused as-is — only the
    // manifest shape matters here, not its content.
    const seedSrc = join(root, 'seed')
    await mkdir(seedSrc, { recursive: true })
    await writeFile(join(seedSrc, 'agent.description'), description('behavior main.behavior'))
    await writeFile(join(seedSrc, 'main.behavior'), MAIN)
    const seedArchive = join(root, 'seed.agent')
    await pack({ dir: seedSrc, out: seedArchive, version: '1.0.0' })
    const aboutmeText = await (await readZip(seedArchive)).file('.agent/aboutme.json')!.async('text')

    const lib = [
      'state lib',
      '  goal "l"',
      '  guide "l"',
      '  interact',
      '  on intent "back" transition to responsive',
      '  on offtopic transition to responsive',
      '',
    ].join('\n')
    const entry = 'merge "behaviors/lib.behavior"\n\n' + MAIN

    const zip = await readZip(seedArchive)
    zip.file('.agent/aboutme.json', aboutmeText)
    zip.file(
      '.agent/files.json',
      JSON.stringify({ description: 'agent.description', behavior: 'agent.behavior', behaviors: ['behaviors/lib.behavior'], guides: [], knowledge: [] }),
    )
    zip.file('agent.description', description('behavior agent.behavior'))
    zip.file('agent.behavior', entry)
    zip.file('behaviors/lib.behavior', lib)
    zip.remove('behaviors/main.behavior')
    const handBuilt = join(root, 'hand.agent')
    await writeZip(zip, handBuilt)

    const unpackedDir = join(root, 'u')
    await unpack({ file: handBuilt, out: unpackedDir })

    // No `behaviors/agent.behavior` exists in this archive to restore from
    // (files.json.behaviors names `behaviors/lib.behavior` only) — the walk
    // starting at the declared entry `agent.behavior` finds nothing under
    // `behaviors/agent.behavior` and bails, so extraction stays verbatim:
    // the real entry, which was already sitting at the root, is untouched.
    const rootBehavior = await readFile(join(unpackedDir, 'agent.behavior'), 'utf-8')
    expect(rootBehavior).toBe(entry)
    const restoredLib = await readFile(join(unpackedDir, 'behaviors', 'lib.behavior'), 'utf-8')
    expect(restoredLib).toBe(lib)

    const secondArchive = join(root, 'a2.agent')
    await expect(pack({ dir: unpackedDir, out: secondArchive, version: '1.0.0' })).resolves.toBeDefined()
  })

  it('an entry named agent.behavior with a merge line restores the original source, merge line included', async () => {
    const root = await scratchDir()
    const srcDir = join(root, 'src-agent')
    await mkdir(srcDir, { recursive: true })
    const lib = [
      'state lib',
      '  goal "l"',
      '  guide "l"',
      '  interact',
      '  on intent "back" transition to responsive',
      '  on offtopic transition to responsive',
      '',
    ].join('\n')
    const entry = 'merge "lib.behavior"\n\n' + MAIN
    await writeFile(join(srcDir, 'agent.description'), description('behavior agent.behavior'))
    await writeFile(join(srcDir, 'agent.behavior'), entry)
    await writeFile(join(srcDir, 'lib.behavior'), lib)

    const firstArchive = join(root, 'a1.agent')
    await pack({ dir: srcDir, out: firstArchive, version: '1.0.0' })

    const unpackedDir = join(root, 'u')
    await unpack({ file: firstArchive, out: unpackedDir })

    const rootBehavior = await readFile(join(unpackedDir, 'agent.behavior'), 'utf-8')
    expect(rootBehavior).toBe(entry) // original source, merge line intact — not the flattened copy
    const restoredLib = await readFile(join(unpackedDir, 'lib.behavior'), 'utf-8')
    expect(restoredLib).toBe(lib)

    const secondArchive = join(root, 'a2.agent')
    await pack({ dir: unpackedDir, out: secondArchive, version: '1.0.0' })
    const first = await readArchive(firstArchive)
    const second = await readArchive(secondArchive)
    expect(second.behavior).toBe(first.behavior)
  })
})
