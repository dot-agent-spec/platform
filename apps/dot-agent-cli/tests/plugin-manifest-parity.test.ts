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

// Deliberately does NOT mock fs/promises or child_process — this suite only reads the real
// plugin.json off disk, via plain node:fs so it doesn't collide with any other test file's fs
// mocking assumptions.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SERVERS, SERVER_NAMES } from '../src/commands/configure.js'

// ADR-DA00-08: plugins/claude/.claude-plugin/plugin.json is now the single source of registration
// for Claude Code; configure.ts's SERVERS/SERVER_NAMES exist only to know what to *remove* from a
// legacy ~/.claude.json (see removeLegacyMcpEntries). The two are hand-kept in sync — this is the
// only guard against them drifting apart.
describe('SERVERS matches plugins/claude/.claude-plugin/plugin.json', () => {
  const manifestPath = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'plugins', 'claude', '.claude-plugin', 'plugin.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))

  it('declares exactly the server names this CLI knows about', () => {
    const expectedNames = Object.values(SERVER_NAMES).sort()
    expect(Object.keys(manifest.mcpServers).sort()).toEqual(expectedNames)
  })

  it('matches command/args for each server', () => {
    for (const [key, serverName] of Object.entries(SERVER_NAMES)) {
      expect(manifest.mcpServers[serverName]).toEqual(SERVERS[key as keyof typeof SERVERS])
    }
  })
})
