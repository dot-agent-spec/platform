// SPDX-License-Identifier: Apache-2.0

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
