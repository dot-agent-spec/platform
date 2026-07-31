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

import { execFile } from 'node:child_process'

/**
 * Runs a coding-agent host's own CLI (e.g. `claude plugin install …`) so `configure` can install a
 * native plugin instead of writing the host's config file directly — see ADR-DA00-08. Hand-wrapped
 * around `execFile` rather than `node:util`'s `promisify`, so the test double only has to be a plain
 * callback function, not honor promisify's custom-promisify-symbol protocol.
 */

export type HostCommandFailure = 'not-found' | 'failed' | 'timed-out'

export class HostCommandError extends Error {
  constructor(
    message: string,
    readonly reason: HostCommandFailure,
    readonly bin: string,
    readonly args: string[],
    readonly exitCode?: number,
    readonly stderr?: string,
  ) {
    super(message)
    this.name = 'HostCommandError'
  }
}

export interface HostCommandResult {
  stdout: string
  stderr: string
}

const TIMEOUT_MS = 120_000
const MAX_BUFFER = 8 * 1024 * 1024 // execFile defaults to 1MB; `plugin list --json` isn't obviously bounded below it.

/**
 * Runs `bin args…` with no shell (argv passed straight through — a filesystem-path argument needs no
 * quoting and cannot inject) and captures stdout/stderr rather than inheriting them, since `configure`
 * prints its own progress lines. Throws `HostCommandError` on any failure, with the host's own stderr
 * folded into `message` — `cli.ts`'s catch-all prints only `err.message`, so that's the one place a
 * caller is guaranteed to see the real diagnosis.
 */
export async function runHostCommand(bin: string, args: string[]): Promise<HostCommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      { encoding: 'utf-8', timeout: TIMEOUT_MS, maxBuffer: MAX_BUFFER },
      (err, stdout, stderr) => {
        if (!err) {
          resolve({ stdout: stdout ?? '', stderr: stderr ?? '' })
          return
        }

        const cmd = `${bin} ${args.join(' ')}`
        const e = err as NodeJS.ErrnoException & { killed?: boolean; code?: number | string }

        // The binary itself doesn't exist — execFile never spawned anything.
        if (e.code === 'ENOENT') {
          reject(
            new HostCommandError(
              `\`${bin}\` is not installed or not on your PATH — cannot configure this host.\n` +
                `Install ${bin}, or configure a host that doesn't need it (--gemini, --murici).`,
              'not-found',
              bin,
              args,
            ),
          )
          return
        }

        // Killed by our own timeout, not by the command's own exit.
        if (e.killed) {
          reject(
            new HostCommandError(`\`${cmd}\` timed out after ${TIMEOUT_MS / 1000}s. Nothing was changed.`, 'timed-out', bin, args),
          )
          return
        }

        // Ran and exited non-zero. err.message from child_process is only "Command failed: <cmd>" —
        // the host's actual diagnosis lives on stderr (occasionally stdout), so fold it in.
        const detail = [stderr, stdout]
          .map(s => (s ?? '').trim())
          .filter(Boolean)
          .join('\n')
        const exitCode = typeof e.code === 'number' ? e.code : undefined
        reject(
          new HostCommandError(
            `\`${cmd}\` failed${exitCode !== undefined ? ` (exit ${exitCode})` : ''}.` + (detail ? `\n${detail}` : ''),
            'failed',
            bin,
            args,
            exitCode,
            stderr,
          ),
        )
      },
    )
  })
}
