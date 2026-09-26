// SPDX-License-Identifier: Apache-2.0

// The parser half of issue #21. cli.ts's old init loop discarded every token it did not
// recognise, so `init --help` — and any typo, and a value-less flag — became a bare `init` that
// scaffolded into process.cwd(). These tests pin the strict behaviour that replaced it.
// cli-args.ts is imported directly rather than cli.ts, which calls main() on import by design.

import { describe, it, expect } from 'vitest'
import {
  USAGE,
  parseInitArgs,
  parsePackArgs,
  parseUnpackArgs,
  parseRunArgs,
  parseConfigureArgs,
  parseServerMcpArgs,
  wantsHelp,
} from '../src/cli-args.js'

describe('parseInitArgs', () => {
  it('rejects an unknown option instead of silently ignoring it', () => {
    expect(() => parseInitArgs(['--drr', '/tmp/x'])).toThrow(/Unknown option/)
  })

  it('rejects --help rather than treating it as a bare init', () => {
    // cli.ts intercepts --help before dispatch; reaching the parser with it is still an error,
    // never a scaffold into the current directory.
    expect(() => parseInitArgs(['--help'])).toThrow(/Unknown option/)
  })

  it('rejects a value flag with no value', () => {
    expect(() => parseInitArgs(['--dir'])).toThrow(/Missing value/)
  })

  it('rejects a value flag whose value is another flag', () => {
    expect(() => parseInitArgs(['--dir', '--force'])).toThrow(/Missing value/)
  })

  it('parses every recognised flag, including --force', () => {
    expect(parseInitArgs(['--name', 'a', '--domain', 'b.com', '--dir', '/tmp/x', '--force'])).toEqual({
      name: 'a',
      domain: 'b.com',
      dir: '/tmp/x',
      force: true,
    })
  })

  it('returns an empty options object for no arguments', () => {
    expect(parseInitArgs([])).toEqual({})
  })

  // Consistency ruling on #46/#47's follow-up review: init must reject a repeated flag exactly
  // like the other five commands — before this, `init --dir a --dir b` silently scaffolded into
  // `b`, keeping only the last value.
  it('rejects a duplicated flag', () => {
    expect(() => parseInitArgs(['--dir', 'a', '--dir', 'b'])).toThrow(/Duplicate option for `init`/)
  })

  it('rejects a stray positional argument, distinctly from an unknown option', () => {
    expect(() => parseInitArgs(['--dir', 'a', 'extra'])).toThrow(/Unexpected argument for `init`: extra/)
  })
})

describe('wantsHelp', () => {
  it('matches --help and -h exactly', () => {
    expect(wantsHelp(['--help'])).toBe(true)
    expect(wantsHelp(['-h'])).toBe(true)
    expect(wantsHelp(['--dir', '/tmp/x', '--help'])).toBe(true)
  })

  it('does not match a flag that merely starts with --help', () => {
    expect(wantsHelp(['--helper'])).toBe(false)
    expect(wantsHelp([])).toBe(false)
  })
})

describe('USAGE', () => {
  // Guards the help gate against a command being added to cli.ts with no usage text: a command
  // missing from USAGE gets no --help handling at all.
  const dispatched = ['init', 'pack', 'unpack', 'run', 'configure', 'server-mcp', 'agents']

  it('has an entry for every command cli.ts dispatches', () => {
    expect(Object.keys(USAGE).sort()).toEqual([...dispatched].sort())
  })

  it('starts each entry with `dot-agent <command>`', () => {
    for (const command of dispatched) {
      expect(USAGE[command].startsWith(`dot-agent ${command}`)).toBe(true)
    }
  })

  it('advertises --force on init', () => {
    expect(USAGE.init).toContain('--force')
  })
})

// Issue #46: pack/unpack/run/configure/server-mcp parsed arguments with a permissive loop that
// silently dropped any token it didn't recognise — `pack --dr /tmp/x` discarded the typo, packed
// cwd, and overwrote /tmp/x with exit 0. These pin the strict replacement, one test per command,
// the same way parseInitArgs is pinned above.

describe('parsePackArgs', () => {
  it('rejects an unknown option instead of silently ignoring it', () => {
    expect(() => parsePackArgs(['--dr', '/tmp/x'])).toThrow(/Unknown option for `pack`/)
  })

  it('rejects a value flag with no value', () => {
    expect(() => parsePackArgs(['--dir'])).toThrow(/Missing value/)
  })

  it('rejects a duplicated flag', () => {
    expect(() => parsePackArgs(['--dir', 'a', '--dir', 'b'])).toThrow(/Duplicate option for `pack`/)
  })

  it('parses every recognised flag', () => {
    expect(parsePackArgs(['--dir', 'a', '--out', 'b.agent', '--commit', 'abc123', '--version', 'v1'])).toEqual({
      dir: 'a',
      out: 'b.agent',
      commit: 'abc123',
      version: 'v1',
    })
  })

  it('returns an empty options object for no arguments', () => {
    expect(parsePackArgs([])).toEqual({})
  })

  // Review follow-up: every prior unknown-token test used a dash-prefixed typo, so a mutant that
  // only rejects dash-prefixed tokens (skipping a stray plain word) still passed everything.
  it('rejects a stray positional argument, distinctly from an unknown option', () => {
    expect(() => parsePackArgs(['--dir', 'a', 'extra'])).toThrow(/Unexpected argument for `pack`: extra/)
  })
})

describe('parseUnpackArgs', () => {
  it('rejects an unknown option instead of silently ignoring it', () => {
    expect(() => parseUnpackArgs(['x.agent', '--froce'])).toThrow(/Unknown option for `unpack`/)
  })

  it('rejects a missing positional file', () => {
    expect(() => parseUnpackArgs([])).toThrow(/Missing <file\.agent>/)
  })

  it('rejects a duplicated flag', () => {
    expect(() => parseUnpackArgs(['x.agent', '--force', '--force'])).toThrow(/Duplicate option for `unpack`/)
  })

  it('parses the positional file plus every recognised flag', () => {
    expect(parseUnpackArgs(['x.agent', '--out', 'dir', '--force'])).toEqual({
      file: 'x.agent',
      out: 'dir',
      force: true,
    })
  })

  it('rejects a stray positional argument after the file, distinctly from an unknown option', () => {
    expect(() => parseUnpackArgs(['f.agent', 'extra'])).toThrow(/Unexpected argument for `unpack`: extra/)
  })
})

describe('parseRunArgs', () => {
  it('rejects an unknown option instead of silently ignoring it', () => {
    expect(() => parseRunArgs(['x.agent', '--mcp-transprot', 'stdio'])).toThrow(/Unknown option for `run`/)
  })

  it('rejects a missing positional source when --helper is absent', () => {
    expect(() => parseRunArgs([])).toThrow(/Missing <file\.agent \| dir>/)
  })

  it('rejects a value flag with no value', () => {
    expect(() => parseRunArgs(['x.agent', '--mcp-transport'])).toThrow(/Missing value/)
  })

  it('rejects a duplicated flag', () => {
    expect(() => parseRunArgs(['x.agent', '--mcp', '--mcp'])).toThrow(/Duplicate option for `run`/)
  })

  it('parses a positional source plus --mcp, --mcp-transport and --mcp-port', () => {
    expect(parseRunArgs(['x.agent', '--mcp', '--mcp-transport', 'http', '--mcp-port', '4000'])).toEqual({
      helper: false,
      source: 'x.agent',
      mcp: true,
      mcpTransport: 'http',
      mcpPort: 4000,
    })
  })

  it('takes --helper instead of a positional source, and implies --mcp', () => {
    expect(parseRunArgs(['--helper'])).toEqual({ helper: true, mcp: true })
  })

  it('rejects a stray positional argument alongside --helper, distinctly from an unknown option', () => {
    expect(() => parseRunArgs(['--helper', 'extra'])).toThrow(/Unexpected argument for `run`: extra/)
  })

  it('rejects an invalid --mcp-transport value the same way as an unknown option', () => {
    expect(() => parseRunArgs(['x.agent', '--mcp-transport', 'bogus'])).toThrow(
      /Invalid value for --mcp-transport in `run`: bogus/
    )
  })

  it('rejects a non-numeric --mcp-port value', () => {
    expect(() => parseRunArgs(['x.agent', '--mcp-port', 'abc'])).toThrow(/Invalid value for --mcp-port in `run`: abc/)
  })

  it('rejects an out-of-range --mcp-port value', () => {
    expect(() => parseRunArgs(['x.agent', '--mcp-port', '70000'])).toThrow(/Invalid value for --mcp-port in `run`/)
    expect(() => parseRunArgs(['x.agent', '--mcp-port', '0'])).toThrow(/Invalid value for --mcp-port in `run`/)
  })
})

describe('parseConfigureArgs', () => {
  it('rejects an unknown option instead of silently ignoring it', () => {
    expect(() => parseConfigureArgs(['--claudee'])).toThrow(/Unknown option for `configure`/)
  })

  it('rejects a duplicated flag', () => {
    expect(() => parseConfigureArgs(['--claude', '--claude'])).toThrow(/Duplicate option for `configure`/)
  })

  it('parses every recognised boolean flag, defaulting the rest to false', () => {
    expect(parseConfigureArgs(['--claude', '--skill'])).toEqual({
      claude: true,
      gemini: false,
      agy: false,
      murici: false,
      skill: true,
      mcp: false,
    })
  })

  it('returns all-false for no arguments', () => {
    expect(parseConfigureArgs([])).toEqual({
      claude: false,
      gemini: false,
      agy: false,
      murici: false,
      skill: false,
      mcp: false,
    })
  })
})

describe('parseServerMcpArgs', () => {
  it('rejects an unknown option instead of silently ignoring it', () => {
    expect(() => parseServerMcpArgs(['--mcp-trnsport', 'stdio'])).toThrow(/Unknown option for `server-mcp`/)
  })

  it('rejects a value flag with no value', () => {
    expect(() => parseServerMcpArgs(['--mcp-port'])).toThrow(/Missing value/)
  })

  it('rejects a duplicated flag', () => {
    expect(() => parseServerMcpArgs(['--mcp-transport', 'stdio', '--mcp-transport', 'http'])).toThrow(
      /Duplicate option for `server-mcp`/
    )
  })

  it('parses --mcp-transport and --mcp-port', () => {
    expect(parseServerMcpArgs(['--mcp-transport', 'http', '--mcp-port', '4000'])).toEqual({
      mcpTransport: 'http',
      mcpPort: 4000,
    })
  })

  it('returns an empty options object for no arguments', () => {
    expect(parseServerMcpArgs([])).toEqual({})
  })

  it('rejects an invalid --mcp-transport value the same way as an unknown option', () => {
    expect(() => parseServerMcpArgs(['--mcp-transport', 'bogus'])).toThrow(
      /Invalid value for --mcp-transport in `server-mcp`: bogus/
    )
  })

  it('rejects a non-numeric or out-of-range --mcp-port value', () => {
    expect(() => parseServerMcpArgs(['--mcp-port', 'abc'])).toThrow(/Invalid value for --mcp-port in `server-mcp`/)
    expect(() => parseServerMcpArgs(['--mcp-port', '70000'])).toThrow(/Invalid value for --mcp-port in `server-mcp`/)
  })
})
