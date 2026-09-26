// SPDX-License-Identifier: Apache-2.0

// Argument parsing for cli.ts, kept in its own side-effect-free module so it can be unit-tested
// without importing cli.ts (which runs main() on import, by design — see cli.ts's trailing call).

import type { InitOptions } from './types.js'

// One usage line per dispatched command. cli.ts builds both the per-command `--help` output and
// the top-level help block from this map, so the two cannot drift apart.
export const USAGE: Record<string, string> = {
  init: 'dot-agent init [--name <name>] [--domain <domain>] [--dir <dir>] [--force]',
  pack: 'dot-agent pack [--dir <dir>] [--out <file>] [--commit <hash>] [--version <tag>]',
  unpack: 'dot-agent unpack <file.agent> [--out <dir>] [--force]',
  run:
    'dot-agent run <file.agent | dir> [--mcp] [--mcp-transport stdio|http] [--mcp-port <n>]\n' +
    'dot-agent run --helper [--mcp-transport stdio|http] [--mcp-port <n>]',
  configure:
    'dot-agent configure [--claude] [--gemini] [--agy] [--murici] [--skill] [--mcp]\n' +
    '  --claude installs the native plugin; --skill/--mcp apply only to --gemini/--murici',
  'server-mcp': 'dot-agent server-mcp [--mcp-transport stdio|http] [--mcp-port <n>]',
  agents: 'dot-agent agents list\ndot-agent agents path <name>',
}

// Exact match only, so `run --helper` is untouched.
export function wantsHelp(argv: string[]): boolean {
  return argv.some(arg => arg === '--help' || arg === '-h')
}

// Shared loop behind every parser below, `init` included: one Map from token to the option key
// it sets, one pass, throw on the first thing that doesn't fit — the shape this module has had
// since parseInitArgs was the only parser here. A caller with a positional argument (run, unpack)
// peels it off before handing the rest of argv to this. A dash-prefixed token that matches
// nothing is `Unknown option`; a bare word in the wrong place (a positional where none is
// expected, or a second one) is `Unexpected argument` — the two typos read very differently to
// someone debugging a script, even though both are refused the same way.
function parseFlagArgs(
  argv: string[],
  command: string,
  valueFlags: Map<string, string>,
  booleanFlags: Map<string, string>,
): Record<string, string | boolean> {
  const options: Record<string, string | boolean> = {}
  const seen = new Set<string>()

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]

    if (booleanFlags.has(token)) {
      if (seen.has(token)) {
        throw new Error(`Duplicate option for \`${command}\`: ${token}\n${USAGE[command]}`)
      }
      seen.add(token)
      options[booleanFlags.get(token)!] = true
      continue
    }

    if (valueFlags.has(token)) {
      if (seen.has(token)) {
        throw new Error(`Duplicate option for \`${command}\`: ${token}\n${USAGE[command]}`)
      }
      seen.add(token)
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('-')) {
        throw new Error(`Missing value for ${token}\n${USAGE[command]}`)
      }
      options[valueFlags.get(token)!] = value
      i++
      continue
    }

    if (token.startsWith('-')) {
      throw new Error(`Unknown option for \`${command}\`: ${token}\n${USAGE[command]}`)
    }
    throw new Error(`Unexpected argument for \`${command}\`: ${token}\n${USAGE[command]}`)
  }

  return options
}

// Strict on purpose. The loop this replaces silently discarded every token it did not recognise,
// so `init --help` — and `init --drr /tmp/x`, and a trailing `--dir` with no value — all collapsed
// into a bare `init` that scaffolded into process.cwd() and overwrote whatever was there.
export function parseInitArgs(argv: string[]): InitOptions {
  return parseFlagArgs(
    argv,
    'init',
    new Map([
      ['--name', 'name'],
      ['--domain', 'domain'],
      ['--dir', 'dir'],
    ]),
    new Map([['--force', 'force']]),
  ) as InitOptions
}

function parseTransport(value: string, command: string): 'stdio' | 'http' {
  if (value !== 'stdio' && value !== 'http') {
    throw new Error(
      `Invalid value for --mcp-transport in \`${command}\`: ${value} (expected stdio or http)\n${USAGE[command]}`
    )
  }
  return value
}

function parsePort(value: string, command: string): number {
  if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
    throw new Error(
      `Invalid value for --mcp-port in \`${command}\`: ${value} (expected an integer 1-65535)\n${USAGE[command]}`
    )
  }
  return Number(value)
}

export interface PackArgs {
  dir?: string
  out?: string
  commit?: string
  version?: string
}

export function parsePackArgs(argv: string[]): PackArgs {
  return parseFlagArgs(
    argv,
    'pack',
    new Map([
      ['--dir', 'dir'],
      ['--out', 'out'],
      ['--commit', 'commit'],
      ['--version', 'version'],
    ]),
    new Map(),
  ) as PackArgs
}

export interface UnpackArgs {
  file: string
  out?: string
  force?: boolean
}

// unpack's file is a required positional, not a flag — peel it off before the shared loop sees
// the rest, exactly as cli.ts's old loop did (it just never rejected anything after that).
export function parseUnpackArgs(argv: string[]): UnpackArgs {
  const file = argv[0]
  if (!file) {
    throw new Error(`Missing <file.agent> for \`unpack\`\n${USAGE.unpack}`)
  }

  const rest = parseFlagArgs(
    argv.slice(1),
    'unpack',
    new Map([['--out', 'out']]),
    new Map([['--force', 'force']]),
  )

  return { file, ...rest } as UnpackArgs
}

export interface RunArgs {
  helper: boolean
  source?: string
  mcp: boolean
  mcpTransport?: 'stdio' | 'http'
  mcpPort?: number
}

// --helper decides whether a positional source is expected at all, so it has to be resolved
// before the shared loop runs — mirrors cli.ts's old `args.includes('--helper')` check, which
// scanned the whole argument list rather than just the first token.
export function parseRunArgs(argv: string[]): RunArgs {
  const helper = argv.includes('--helper')
  const source = helper ? undefined : argv[0]

  if (!helper && !source) {
    throw new Error(`Missing <file.agent | dir> for \`run\`\n${USAGE.run}`)
  }

  const optArgv = helper ? argv : argv.slice(1)
  const raw = parseFlagArgs(
    optArgv,
    'run',
    new Map([
      ['--mcp-transport', 'mcpTransport'],
      ['--mcp-port', 'mcpPort'],
    ]),
    new Map([
      ['--mcp', 'mcp'],
      ['--helper', 'helper'],
    ]),
  )

  const options: RunArgs = { helper, mcp: raw.mcp === true || helper }
  if (!helper) options.source = source
  if (raw.mcpTransport !== undefined) options.mcpTransport = parseTransport(raw.mcpTransport as string, 'run')
  if (raw.mcpPort !== undefined) options.mcpPort = parsePort(raw.mcpPort as string, 'run')

  return options
}

export interface ConfigureArgs {
  claude: boolean
  gemini: boolean
  agy: boolean
  murici: boolean
  skill: boolean
  mcp: boolean
}

export function parseConfigureArgs(argv: string[]): ConfigureArgs {
  const raw = parseFlagArgs(
    argv,
    'configure',
    new Map(),
    new Map([
      ['--claude', 'claude'],
      ['--gemini', 'gemini'],
      ['--agy', 'agy'],
      ['--murici', 'murici'],
      ['--skill', 'skill'],
      ['--mcp', 'mcp'],
    ]),
  )

  return {
    claude: false,
    gemini: false,
    agy: false,
    murici: false,
    skill: false,
    mcp: false,
    ...raw,
  } as ConfigureArgs
}

export interface ServerMcpArgs {
  mcpTransport?: 'stdio' | 'http'
  mcpPort?: number
}

export function parseServerMcpArgs(argv: string[]): ServerMcpArgs {
  const raw = parseFlagArgs(
    argv,
    'server-mcp',
    new Map([
      ['--mcp-transport', 'mcpTransport'],
      ['--mcp-port', 'mcpPort'],
    ]),
    new Map(),
  )

  const options: ServerMcpArgs = {}
  if (raw.mcpTransport !== undefined) options.mcpTransport = parseTransport(raw.mcpTransport as string, 'server-mcp')
  if (raw.mcpPort !== undefined) options.mcpPort = parsePort(raw.mcpPort as string, 'server-mcp')

  return options
}
