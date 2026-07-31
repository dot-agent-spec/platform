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

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runHostCommand, HostCommandError } from '../src/host-command.js'

// Must match the SUT's import specifier byte-for-byte ('node:child_process') — vitest does not alias
// 'child_process' <-> 'node:child_process', and a mismatch silently no-ops this mock, letting the real
// binary run instead.
type Cb = (err: any, stdout: string, stderr: string) => void
const execFileMock = vi.fn((_bin: string, _args: string[], _opts: any, cb: Cb) => {
  cb(null, '', '')
})

vi.mock('node:child_process', () => ({
  execFile: (...callArgs: any[]) => (execFileMock as any)(...callArgs),
}))

describe('runHostCommand', () => {
  beforeEach(() => {
    execFileMock.mockReset()
  })

  it('resolves stdout/stderr on success', async () => {
    execFileMock.mockImplementation((_bin, _args, _opts, cb: Cb) => cb(null, 'out', 'warn'))

    const result = await runHostCommand('claude', ['plugin', 'list', '--json'])
    expect(result).toEqual({ stdout: 'out', stderr: 'warn' })
  })

  it('reports a missing binary distinctly from a failed command', async () => {
    const enoent = Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' })
    execFileMock.mockImplementation((_bin, _args, _opts, cb: Cb) => cb(enoent, '', ''))

    await expect(runHostCommand('claude', ['plugin', 'install', 'dot-agent'])).rejects.toMatchObject({
      reason: 'not-found',
      bin: 'claude',
    })
    await expect(runHostCommand('claude', ['plugin', 'install', 'dot-agent'])).rejects.toThrow(/not on your PATH/)
  })

  it('folds stderr into the thrown message on a non-zero exit', async () => {
    const failure = Object.assign(new Error('Command failed: claude plugin install bogus'), { code: 1 })
    execFileMock.mockImplementation((_bin, _args, _opts, cb: Cb) => cb(failure, '', '✘ Unknown plugin "bogus"'))

    let caught: HostCommandError | undefined
    try {
      await runHostCommand('claude', ['plugin', 'install', 'bogus'])
    } catch (err) {
      caught = err as HostCommandError
    }
    expect(caught).toBeInstanceOf(HostCommandError)
    expect(caught!.reason).toBe('failed')
    expect(caught!.exitCode).toBe(1)
    expect(caught!.message).toContain('✘ Unknown plugin "bogus"')
  })

  it('reports a timeout distinctly from a failed command', async () => {
    const timeout = Object.assign(new Error('Command timed out'), { killed: true })
    execFileMock.mockImplementation((_bin, _args, _opts, cb: Cb) => cb(timeout, '', ''))

    await expect(runHostCommand('claude', ['plugin', 'install', 'dot-agent'])).rejects.toMatchObject({
      reason: 'timed-out',
    })
  })
})
