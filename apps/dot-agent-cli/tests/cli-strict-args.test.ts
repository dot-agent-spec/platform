// SPDX-License-Identifier: Apache-2.0

// Issue #46: cli.ts's old permissive loops for pack/unpack/run/configure/server-mcp silently
// dropped any token they didn't recognise. The issue's own measurement was `pack --dr /tmp/x`:
// the typo for --dir was discarded, the command packed cwd instead, and it overwrote /tmp/x with
// exit 0. tests/cli-args.test.ts pins the parser functions directly (unit level, the same way
// parseInitArgs is pinned for `init`); this file drives the real built `dot-agent` binary end to
// end, in a scratch directory under $TMPDIR, to prove the wiring in cli.ts actually rejects the
// typo before any command function — and therefore any file write — runs.

import { describe, it, expect, beforeAll } from 'vitest'
import { execFile, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm, writeFile, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'

const execFileAsync = promisify(execFile)
const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const cliBin = join(pkgRoot, 'dist', 'cli.mjs')

beforeAll(() => {
  // Build from the current source rather than trusting a dist/ left over from a previous run —
  // these tests exist to prove what cli.ts does today, not what it did last time someone built it.
  execFileSync('npm', ['run', 'build'], { cwd: pkgRoot, stdio: 'ignore' })
}, 60_000)

async function runCli(cliArgs: string[], cwd: string) {
  try {
    const { stdout, stderr } = await execFileAsync('node', [cliBin, ...cliArgs], { cwd })
    return { code: 0, stdout, stderr }
  } catch (err: any) {
    return { code: typeof err.code === 'number' ? err.code : 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' }
  }
}

describe('dot-agent CLI rejects an unknown option before touching a file (issue #46)', () => {
  it('pack: the issue\'s own repro — --dr typo is refused, the output file is untouched', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dot-agent-cli-pack-'))
    try {
      const outFile = join(dir, 'out.agent')
      await writeFile(outFile, 'SENTINEL')

      const { code, stderr } = await runCli(['pack', '--dr', dir, '--out', outFile], dir)

      expect(code).not.toBe(0)
      expect(stderr).toMatch(/Unknown option/)
      expect(stderr).toMatch(/pack/)
      expect(await readFile(outFile, 'utf-8')).toBe('SENTINEL')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('unpack: an unknown option is refused before any extraction is attempted', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dot-agent-cli-unpack-'))
    try {
      const { code, stderr } = await runCli(['unpack', 'whatever.agent', '--froce'], dir)

      expect(code).not.toBe(0)
      expect(stderr).toMatch(/Unknown option/)
      expect(stderr).toMatch(/unpack/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('run: an unknown option is refused before the source is loaded', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dot-agent-cli-run-'))
    try {
      const { code, stderr } = await runCli(['run', 'x.agent', '--mcp-transprot', 'stdio'], dir)

      expect(code).not.toBe(0)
      expect(stderr).toMatch(/Unknown option/)
      expect(stderr).toMatch(/run/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('configure: an unknown option is refused before any host command runs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dot-agent-cli-configure-'))
    try {
      const { code, stderr } = await runCli(['configure', '--claudee'], dir)

      expect(code).not.toBe(0)
      expect(stderr).toMatch(/Unknown option/)
      expect(stderr).toMatch(/configure/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('server-mcp: an unknown option is refused before the server starts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dot-agent-cli-server-mcp-'))
    try {
      const { code, stderr } = await runCli(['server-mcp', '--mcp-trnsport', 'stdio'], dir)

      expect(code).not.toBe(0)
      expect(stderr).toMatch(/Unknown option/)
      expect(stderr).toMatch(/server-mcp/)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('dot-agent init names its own override on refusal (issue #47)', () => {
  it('a second init in the same scratch directory is refused and points at --force', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dot-agent-cli-init-'))
    try {
      expect((await runCli(['init', '--dir', dir], dir)).code).toBe(0)
      const { code, stdout, stderr } = await runCli(['init', '--dir', dir], dir)
      expect(code).not.toBe(0)
      expect(stdout + stderr).toMatch(/Refusing to overwrite/)
      expect(stdout + stderr).toMatch(/Use --force to overwrite\./)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
