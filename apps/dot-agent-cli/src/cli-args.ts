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

// Strict on purpose. The loop this replaces silently discarded every token it did not recognise,
// so `init --help` — and `init --drr /tmp/x`, and a trailing `--dir` with no value — all collapsed
// into a bare `init` that scaffolded into process.cwd() and overwrote whatever was there.
export function parseInitArgs(argv: string[]): InitOptions {
  const options: InitOptions = {}
  const valueFlags = new Map<string, 'name' | 'domain' | 'dir'>([
    ['--name', 'name'],
    ['--domain', 'domain'],
    ['--dir', 'dir'],
  ])

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token === '--force') {
      options.force = true
      continue
    }
    const key = valueFlags.get(token)
    if (key) {
      const value = argv[i + 1]
      if (value === undefined || value.startsWith('-')) {
        throw new Error(`Missing value for ${token}\n${USAGE.init}`)
      }
      options[key] = value
      i++
      continue
    }
    throw new Error(`Unknown option for \`init\`: ${token}\n${USAGE.init}`)
  }

  return options
}
