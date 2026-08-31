// SPDX-License-Identifier: Apache-2.0

// The parser half of issue #21. cli.ts's old init loop discarded every token it did not
// recognise, so `init --help` — and any typo, and a value-less flag — became a bare `init` that
// scaffolded into process.cwd(). These tests pin the strict behaviour that replaced it.
// cli-args.ts is imported directly rather than cli.ts, which calls main() on import by design.

import { describe, it, expect } from 'vitest'
import { USAGE, parseInitArgs, wantsHelp } from '../src/cli-args.js'

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
