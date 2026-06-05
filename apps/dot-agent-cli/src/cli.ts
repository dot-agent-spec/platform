#!/usr/bin/env node

import { init, pack, unpack, run } from './index.js'

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
    } else if (command === 'run') {
      const source = args[1]
      if (!source) {
        formatError('Usage: dot-agent run <file.agent | dir>')
        process.exit(1)
      }

      const context = await run({ source })
      formatSuccess(`Agent loaded: ${context.id}`)
    } else {
      console.log(`dot-agent CLI v1.0.0

Usage:
  dot-agent init [--name <name>] [--domain <domain>] [--dir <dir>]
  dot-agent pack [--dir <dir>] [--out <file>] [--commit <hash>] [--version <tag>]
  dot-agent unpack <file.agent> [--out <dir>] [--force]
  dot-agent run <file.agent | dir>
`)
    }
  } catch (err: any) {
    formatError(err.message)
    process.exit(1)
  }
}

main()
