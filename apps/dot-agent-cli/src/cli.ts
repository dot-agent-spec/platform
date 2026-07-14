#!/usr/bin/env node

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

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import * as p from '@clack/prompts'

import { version } from './version.js'
import { init, pack, unpack, run, configure, startDevMcpServer } from './index.js'

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

async function main() {
  try {
    if (command === 'init') {
      const options: any = {}
      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--name' && i + 1 < args.length) options.name = args[++i]
        if (args[i] === '--domain' && i + 1 < args.length) options.domain = args[++i]
        if (args[i] === '--dir' && i + 1 < args.length) options.dir = args[++i]
      }

      const result = await init(options)
      formatSuccess(`Scaffolded agent project in ${result.dir}`)
      console.log(`  Files: ${result.files.join(', ')}`)
    } else if (command === 'pack') {
      const options: any = {}
      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--dir' && i + 1 < args.length) options.dir = args[++i]
        if (args[i] === '--out' && i + 1 < args.length) options.out = args[++i]
        if (args[i] === '--commit' && i + 1 < args.length) options.commit = args[++i]
        if (args[i] === '--version' && i + 1 < args.length) options.version = args[++i]
      }

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
      const file = args[1]
      if (!file) {
        formatError('Usage: dot-agent unpack <file.agent> [--out <dir>] [--force]')
        process.exit(1)
      }

      const options: any = { file }
      for (let i = 2; i < args.length; i++) {
        if (args[i] === '--out' && i + 1 < args.length) options.out = args[++i]
        if (args[i] === '--force') options.force = true
      }

      const result = await unpack(options)
      formatSuccess(`Unpacked to ${result.dir}`)
      console.log(`  ID: ${result.id}`)
      console.log(`  Files: ${result.files.length}`)
    } else if (command === 'configure') {
      const claude = args.includes('--claude')
      const gemini = args.includes('--gemini')
      const agy = args.includes('--agy')
      const skill = args.includes('--skill')
      const mcp = args.includes('--mcp')

      const hasTarget = claude || gemini || agy

      let targetClaude = claude
      let targetGemini = gemini || agy
      let configSkill = skill
      let configMcp = mcp

      if (!hasTarget) {
        if (!process.stdout.isTTY || !process.stdin.isTTY) {
          formatError('Error: Missing target platform parameter (use --claude, --gemini, or --agy) in non-TTY environment.')
          process.exit(1)
        }

        p.intro('dot-agent - Client Configurer')

        const targetOption = await p.select({
          message: 'Select target platform:',
          options: [
            { value: 'claude', label: 'Claude Code' },
            { value: 'gemini', label: 'Gemini / AGY' },
            { value: 'both', label: 'Both platforms' },
          ],
        })

        if (p.isCancel(targetOption)) {
          p.cancel('Configuration cancelled.')
          process.exit(0)
        }

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

        targetClaude = targetOption === 'claude' || targetOption === 'both'
        targetGemini = targetOption === 'gemini' || targetOption === 'both'
        configSkill = configTypeOption === 'skill' || configTypeOption === 'both'
        configMcp = configTypeOption === 'mcp' || configTypeOption === 'both'
      } else {
        if (!skill && !mcp) {
          configSkill = true
          configMcp = true
        }
      }

      const results = await configure({
        claude: targetClaude,
        gemini: targetGemini,
        skill: configSkill,
        mcp: configMcp,
      })

      for (const result of results) {
        if (result.skillInstalled && result.dest) {
          formatSuccess(`Skill installed → ${result.dest}`)
          if (result.dest.includes('.claude')) {
            console.log(`  Add to CLAUDE.md: @~/.claude/skills/dot-agent/SKILL.md`)
          } else {
            console.log(`  Skill is now globally active in Gemini/AGY config directory.`)
          }
        }
        if (result.mcpConfigured && result.mcpConfigPath) {
          formatSuccess(`MCP servers (helper and dev) registered → ${result.mcpConfigPath}`)
          formatWarning('Restart/reconnect your MCP client for the new servers to become available.')
        }
      }
    } else if (command === 'server-mcp') {
      const mcpTransportIdx = args.indexOf('--mcp-transport')
      const mcpPortIdx = args.indexOf('--mcp-port')

      let mcpTransport = mcpTransportIdx !== -1 ? args[mcpTransportIdx + 1] as 'stdio' | 'http' : undefined
      let mcpPort = mcpPortIdx !== -1 ? parseInt(args[mcpPortIdx + 1], 10) : undefined

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
      const isHelper = args.includes('--helper')
      const sourceArg = isHelper ? undefined : args[1]

      if (!isHelper && !sourceArg) {
        formatError('Usage: dot-agent run <file.agent | dir> [--mcp] [--mcp-transport stdio|http] [--mcp-port <n>]')
        formatError('       dot-agent run --helper [--mcp-transport stdio|http] [--mcp-port <n>]')
        process.exit(1)
      }

      const runArgs = isHelper ? args.slice(1) : args.slice(2)
      const mcp = runArgs.includes('--mcp') || isHelper
      const mcpTransportIdx = runArgs.indexOf('--mcp-transport')
      const mcpPortIdx = runArgs.indexOf('--mcp-port')
      const mcpTransport = mcpTransportIdx !== -1 ? runArgs[mcpTransportIdx + 1] as 'stdio' | 'http' : undefined
      const mcpPort = mcpPortIdx !== -1 ? parseInt(runArgs[mcpPortIdx + 1], 10) : undefined

      const helperAsset = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'helper.agent')
      const source = isHelper ? helperAsset : sourceArg!

      const result = await run({ source, mcp, mcpTransport, mcpPort })
      if (!mcp) {
        formatSuccess(`Agent loaded: ${result.bundle.id}`)
        console.log(`  State: ${result.session.getState()}`)
      }
    } else {
      console.log(`dot-agent CLI v${version}
Requires Node.js >=24.0.0.

Getting started (for an AI assistant setting this up):
  1. dot-agent configure --claude   (or --gemini)  — installs the skill and registers the
     dot-agent-helper and dot-agent-dev MCP servers in one step.
  2. Restart/reconnect this session so the new MCP servers become available.
  3. Once connected, read dot-agent://howto and dot-agent://intents on the dot-agent-helper
     server to learn how to navigate from there.

Usage:
  dot-agent init [--name <name>] [--domain <domain>] [--dir <dir>]
  dot-agent pack [--dir <dir>] [--out <file>] [--commit <hash>] [--version <tag>]
  dot-agent unpack <file.agent> [--out <dir>] [--force]
  dot-agent run <file.agent | dir> [--mcp] [--mcp-transport stdio|http] [--mcp-port <n>]
  dot-agent run --helper [--mcp-transport stdio|http] [--mcp-port <n>]
  dot-agent configure [--claude] [--gemini] [--agy] [--skill] [--mcp]
  dot-agent server-mcp [--mcp-transport stdio|http] [--mcp-port <n>]
`)
    }
  } catch (err: any) {
    formatError(err.message)
    process.exit(1)
  }
}

main()
