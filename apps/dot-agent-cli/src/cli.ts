#!/usr/bin/env node

// SPDX-License-Identifier: Apache-2.0

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import * as p from '@clack/prompts'

import { version } from './version.js'
import { init, pack, unpack, run, configure, startDevMcpServer, listAgents, getAgentPath } from './index.js'
import { USAGE, parseInitArgs, parsePackArgs, parseUnpackArgs, parseRunArgs, parseConfigureArgs, parseServerMcpArgs, wantsHelp } from './cli-args.js'

const args = process.argv.slice(2)
const command = args[0]

function formatError(msg: string) {
  const lines = msg.split('\n')
  console.error(`\x1b[31m✗\x1b[0m ${lines[0]}`)
  if (lines.length > 1) {
    lines.slice(1).forEach(line => console.error(`  ${line}`))
  }
}

function formatSuccess(msg: string) {
  console.log(`\x1b[32m✓\x1b[0m ${msg}`)
}

function formatWarning(msg: string) {
  console.warn(`\x1b[33m⚠\x1b[0m ${msg}`)
}

function indentUsage(entry: string) {
  return entry.split('\n').map(line => `  ${line}`).join('\n')
}

async function main() {
  try {
    // One uniform help gate, ahead of dispatch: `init --help` must print help rather than reach
    // the strict parser and come back as an unknown-option error.
    if (command !== undefined && Object.hasOwn(USAGE, command) && wantsHelp(args.slice(1))) {
      console.log(`Usage:\n${indentUsage(USAGE[command])}`)
      return
    }

    if (command === 'init') {
      const options = parseInitArgs(args.slice(1))

      const result = await init(options).catch((err: any) => {
        if (err?.code === 'INIT_COLLISION') err.message += '\nUse --force to overwrite.'
        throw err
      })
      formatSuccess(`Scaffolded agent project in ${result.dir}`)
      console.log(`  Files: ${result.files.join(', ')}`)
    } else if (command === 'pack') {
      const options = parsePackArgs(args.slice(1))

      const result = await pack(options)
      formatSuccess(`Packed → ${result.path}`)
      console.log(`  ID: ${result.id}`)
      if (result.warnings.length > 0) {
        console.log(`  Warnings: ${result.warnings.length}`)
        result.warnings.forEach(w => {
          formatWarning(`${w.file}:${w.line}:${w.col} ${w.code} ${w.message}`)
        })
      }
    } else if (command === 'unpack') {
      const options = parseUnpackArgs(args.slice(1))

      const result = await unpack(options)
      formatSuccess(`Unpacked to ${result.dir}`)
      console.log(`  ID: ${result.id}`)
      console.log(`  Files: ${result.files.length}`)
    } else if (command === 'configure') {
      const { claude, gemini, agy, murici, skill, mcp } = parseConfigureArgs(args.slice(1))

      const hasTarget = claude || gemini || agy || murici

      let targetClaude = claude
      let targetGemini = gemini || agy
      let targetMurici = murici
      let configSkill = skill
      let configMcp = mcp

      if (!hasTarget) {
        if (!process.stdout.isTTY || !process.stdin.isTTY) {
          formatError('Error: Missing target platform parameter (use --claude, --gemini, --agy, or --murici) in non-TTY environment.')
          process.exit(1)
        }

        p.intro('dot-agent - Client Configurer')

        const targetOption = await p.select({
          message: 'Select target platform:',
          options: [
            { value: 'claude', label: 'Claude Code' },
            { value: 'gemini', label: 'Gemini / AGY' },
            { value: 'murici', label: 'Murici' },
            { value: 'all', label: 'All platforms' },
          ],
        })

        if (p.isCancel(targetOption)) {
          p.cancel('Configuration cancelled.')
          process.exit(0)
        }

        targetClaude = targetOption === 'claude' || targetOption === 'all'
        targetGemini = targetOption === 'gemini' || targetOption === 'all'
        targetMurici = targetOption === 'murici' || targetOption === 'all'

        // Skill/MCP-only is a distinction that only exists for gemini/murici, which still write files
        // directly. Claude Code installs the plugin as one unit (ADR-DA00-08), so skip the question
        // when claude is the only target picked — there is nothing it would change.
        if (targetOption === 'claude') {
          configSkill = true
          configMcp = true
        } else {
          const configTypeOption = await p.select({
            message: 'Select what to configure:',
            options: [
              { value: 'both', label: 'Both Skill and MCP (Recommended)' },
              { value: 'skill', label: 'Skill only' },
              { value: 'mcp', label: 'MCP configuration only' },
            ],
          })

          if (p.isCancel(configTypeOption)) {
            p.cancel('Configuration cancelled.')
            process.exit(0)
          }

          configSkill = configTypeOption === 'skill' || configTypeOption === 'both'
          configMcp = configTypeOption === 'mcp' || configTypeOption === 'both'
        }
      } else {
        if (!skill && !mcp) {
          configSkill = true
          configMcp = true
        }
      }

      const results = await configure({
        claude: targetClaude,
        gemini: targetGemini,
        murici: targetMurici,
        skill: configSkill,
        mcp: configMcp,
      })

      for (const result of results) {
        if (result.pluginId) {
          if (result.marketplaceAdded) {
            formatSuccess(`Marketplace "${result.marketplaceName}" added → ${result.marketplaceSource}`)
          } else if (result.marketplaceName) {
            console.log(`  Using existing marketplace "${result.marketplaceName}" → ${result.marketplaceSource} (not re-pointed)`)
          }
          const versionLabel = result.pluginVersion ? ` v${result.pluginVersion}` : ''
          formatSuccess(`Plugin ${result.pluginId}${versionLabel} installed (user scope) — it carries the skills and both MCP servers`)
          if (result.pluginEnabled === false) {
            formatWarning(`${result.pluginId} is installed but disabled — run \`claude plugin enable ${result.pluginId}\`.`)
          }
        }

        if (result.legacyEntriesRemoved && result.legacyEntriesRemoved.length > 0) {
          formatSuccess(`Removed stale CLI-written MCP entries (${result.legacyEntriesRemoved.join(', ')}) from ${result.legacyConfigPath}`)
        }

        if (result.skillInstalled && result.dest) {
          formatSuccess(`Skill installed → ${result.dest}`)
          if (result.target === 'gemini') {
            console.log(`  Skill is now globally active in the Gemini/AGY config directory.`)
          }
        }
        if (result.skillSkippedReason) {
          formatWarning(result.skillSkippedReason)
        }
        if (result.mcpConfigured && result.mcpConfigPath) {
          const serverLabels = (result.registeredServers ?? []).join(' and ')
          formatSuccess(`MCP servers (${serverLabels}) registered → ${result.mcpConfigPath}`)
        }
      }

      if (results.some(r => r.pluginId || r.mcpConfigured || (r.legacyEntriesRemoved && r.legacyEntriesRemoved.length > 0))) {
        formatWarning('Restart Claude Code / reconnect your MCP client for the change to take effect.')
      }
    } else if (command === 'server-mcp') {
      const parsed = parseServerMcpArgs(args.slice(1))
      let mcpTransport = parsed.mcpTransport
      let mcpPort = parsed.mcpPort

      if (!mcpTransport) {
        if (!process.stdout.isTTY || !process.stdin.isTTY) {
          formatError('Error: Missing transport parameter (use --mcp-transport stdio|http) in non-TTY environment.')
          process.exit(1)
        }

        p.intro('dot-agent - Utility MCP Server')

        const transportOption = await p.select({
          message: 'Select MCP transport type:',
          options: [
            { value: 'stdio', label: 'stdio (Standard Stdin/Stdout)' },
            { value: 'http', label: 'http (Server SSE)' },
          ],
        })

        if (p.isCancel(transportOption)) {
          p.cancel('Server launch cancelled.')
          process.exit(0)
        }

        mcpTransport = transportOption as 'stdio' | 'http'

        if (mcpTransport === 'http') {
          const portOption = await p.text({
            message: 'Enter HTTP server port:',
            placeholder: '3000',
            defaultValue: '3000',
            validate: (val) => {
              const num = parseInt(val, 10)
              if (isNaN(num) || num <= 0 || num > 65535) {
                return 'Please enter a valid port number (1-65535).'
              }
            }
          })

          if (p.isCancel(portOption)) {
            p.cancel('Server launch cancelled.')
            process.exit(0)
          }

          mcpPort = parseInt(portOption, 10)
        }
      }

      await startDevMcpServer({
        transport: mcpTransport,
        port: mcpPort ?? 3000,
      })
    } else if (command === 'run') {
      const options = parseRunArgs(args.slice(1))

      const helperAsset = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'helper.agent')
      const source = options.helper ? helperAsset : options.source!

      const result = await run({ source, mcp: options.mcp, mcpTransport: options.mcpTransport, mcpPort: options.mcpPort })
      if (!options.mcp) {
        formatSuccess(`Agent loaded: ${result.bundle.id}`)
        console.log(`  State: ${result.session.getState()}`)
      }
    } else if (command === 'agents') {
      const sub = args[1]
      if (sub === 'list') {
        const agents = await listAgents()
        agents.forEach(a => console.log(a.name))
      } else if (sub === 'path') {
        const name = args[2]
        if (!name) {
          formatError('Usage: dot-agent agents path <name>')
          process.exit(1)
        }
        console.log(await getAgentPath(name))
      } else {
        formatError('Usage: dot-agent agents list')
        formatError('       dot-agent agents path <name>')
        process.exit(1)
      }
    } else {
      console.log(`dot-agent CLI v${version}
Requires Node.js >=24.0.0.

Getting started (for an AI assistant setting this up):
  1. dot-agent configure --claude installs the dot-agent plugin for Claude Code (adds the
     dot-agent-spec marketplace, installs the plugin, and removes any MCP entries an older
     version of this command left in ~/.claude.json) — it carries the skills and both MCP
     servers. Run the equivalent commands yourself if you'd rather not shell out:
       claude plugin marketplace add dot-agent-spec/platform
       claude plugin install dot-agent@dot-agent-spec
     Elsewhere: dot-agent configure --gemini (or --murici) installs the skill and registers the
     dot-agent-helper and dot-agent MCP servers in one step. --skill/--mcp only narrow those two
     targets — a plugin install always does both.
  2. Restart/reconnect this session so the new MCP servers become available.
  3. Once connected, read dot-agent://howto and dot-agent://intents on the dot-agent-helper
     server to learn how to navigate from there. To run your own agent, call load_agent on the
     dot-agent server, then drive it the same way (send_intent, dot-agent://state, ...).

Usage:
${Object.values(USAGE).map(indentUsage).join('\n')}

Any command also accepts --help / -h for just its own usage line.

Note: --mcp-transport http binds to 127.0.0.1 and keeps one shared FSM/memory instance for
the life of the process — a debug convenience (reconnect without losing state), not
multi-client isolation. Restart the process for a clean state.
`)
    }
  } catch (err: any) {
    formatError(err.message)
    process.exit(1)
  }
}

main()
