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

import { describe, it, expect, afterAll } from 'vitest'
import { join } from 'path'
import { rm, stat, readFile } from 'fs/promises'
import { init } from '../src/commands/init.js'
import { pack } from '../src/commands/pack.js'
import { unpack } from '../src/commands/unpack.js'
import { run } from '../src/commands/run.js'

describe('CLI Commands Integration', () => {
  const tempDir = join(process.cwd(), 'temp_test_cli')
  const outAgent = join(tempDir, 'my-agent.agent')
  const unpackDir = join(tempDir, 'unpacked')

  afterAll(async () => {
    try {
      await rm(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('scaffolds project using init command', async () => {
    const result = await init({
      dir: tempDir,
      name: 'my-agent',
      domain: 'test.com',
    })

    expect(result.dir).toBe(tempDir)
    expect(result.files).toContain('agent.description')
    expect(result.files).toContain('agent.behavior')
    expect(result.files).toContain('SOUL.md')

    const descContent = await readFile(join(tempDir, 'agent.description'), 'utf-8')
    expect(descContent).toContain('agent my-agent')
    expect(descContent).toContain('domain test.com')
  })

  it('packages project using pack command', async () => {
    const result = await pack({
      dir: tempDir,
      out: outAgent,
      version: 'v1.2.3',
      commit: 'abc1234',
    })

    expect(result.path).toBe(outAgent)
    expect(result.id).toContain('test.com/my-agent:v1.2.3~abc1234')
    expect(result.warnings).toHaveLength(0)

    const fileStat = await stat(outAgent)
    expect(fileStat.size).toBeGreaterThan(0)
  })

  it('unzips project using unpack command', async () => {
    const result = await unpack({
      file: outAgent,
      out: unpackDir,
      force: true,
    })

    expect(result.dir).toBe(unpackDir)
    expect(result.id).toContain('test.com/my-agent:v1.2.3~abc1234')
    expect(result.files).toContain('agent.description')
    expect(result.files).toContain('agent.behavior')

    const unpackedDesc = await readFile(join(unpackDir, 'agent.description'), 'utf-8')
    expect(unpackedDesc).toContain('agent my-agent')
  })

  it('executes project using run command on local directory', async () => {
    const context = await run({
      source: tempDir,
    })

    expect(context.id).toBe('local/my-agent:v1.0')
    expect(context.aboutme.name).toBe('my-agent')
    expect(context.files.soul).toContain('# my-agent')
  })

  it('executes project using run command on .agent bundle', async () => {
    const context = await run({
      source: outAgent,
    })

    expect(context.id).toBe('test.com/my-agent:v1.2.3~abc1234')
    expect(context.aboutme.name).toBe('my-agent')
  })
})
