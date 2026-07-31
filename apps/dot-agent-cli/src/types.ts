// SPDX-License-Identifier: Apache-2.0

import type { AboutMe, AgentBundle, LintMessage, PackOptions, PackResult, Integrity } from '@dot-agent/compiler'
import type { AgentSession } from '@dot-agent/sdk'

export type { AboutMe, AgentBundle, LintMessage, PackOptions, PackResult, Integrity }

export interface InitOptions {
  name?: string
  domain?: string
  dir?: string
}

export interface InitResult {
  dir: string
  files: string[]
}

export interface UnpackOptions {
  file: string
  out?: string
  force?: boolean
}

export interface UnpackResult {
  dir: string
  id: string
  files: string[]
  aboutme: AboutMe
}

export interface RunOptions {
  source: string
  mcp?: boolean
  mcpTransport?: 'stdio' | 'http'
  mcpPort?: number
}

export interface RunResult {
  bundle: AgentBundle
  session: AgentSession
}

export interface Skill {
  id: string
  description: string
}

export interface ParsedDescription {
  domain: string
  name: string
  version: string
  description: string
  capabilities: Array<{
    name: string
    type?: string
    description: string
  }>
  [key: string]: any
}

export interface ParsedBehavior {
  [key: string]: any
}
