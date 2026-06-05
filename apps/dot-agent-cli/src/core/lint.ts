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
import { Parser, Language } from 'web-tree-sitter'
import { AgentDSLKernel, init as initKernel } from '@dot-agent/kernel-dsl'
import { LintMessage } from '../types.js'

const require = createRequire(import.meta.url)
const { agentWasmPath, behaviorWasmPath } = require('@dot-agent/tree-sitter')

declare module '@dot-agent/tree-sitter' {
  export const agentWasmPath: string
  export const behaviorWasmPath: string
}

let _initialized = false
let _agentParser: Parser
let _behaviorParser: Parser
let _agentLang: any
let _behaviorLang: any

async function ensureWasmInit() {
  if (_initialized) return

  try {
    await Parser.init()
  } catch (err) {
    throw err
  }

  _agentParser = new Parser()
  _behaviorParser = new Parser()

  try {
    _agentLang = await Language.load(agentWasmPath)
    _behaviorLang = await Language.load(behaviorWasmPath)
  } catch (err) {
    throw err
  }

  try {
    await initKernel()
  } catch (err) {
    // Silently fail - kernel might not be available in all environments
    // We can continue with tree-sitter only for syntax checking
  }

  _initialized = true
}

function collectSyntaxErrors(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
  const errors: Parser.SyntaxNode[] = []
  if (node.isError || node.isMissing) errors.push(node)
  for (const child of node.children) {
    errors.push(...collectSyntaxErrors(child))
  }
  return errors
}

function getLineCol(node: Parser.SyntaxNode): { line: number; col: number } {
  return { line: node.startPosition.row + 1, col: node.startPosition.column + 1 }
}

export async function lintDescription(text: string): Promise<LintMessage[]> {
  await ensureWasmInit()

  _agentParser.setLanguage(_agentLang)
  const tree = _agentParser.parse(text)
  const messages: LintMessage[] = []

  const syntaxErrors = collectSyntaxErrors(tree.rootNode)
  if (syntaxErrors.length > 0) {
    for (const error of syntaxErrors) {
      const { line, col } = getLineCol(error)
      messages.push({
        file: 'agent.description',
        line,
        col,
        severity: 'error',
        code: 'E004',
        message: 'Syntax error in description',
      })
    }
  }

  const walk = (node: Parser.SyntaxNode) => {
    if (node.type === 'domain_declaration' && node.childCount > 0) {
      const valueNode = node.child(node.childCount - 1)
      if (valueNode && valueNode.text === 'example.com') {
        const { line, col } = getLineCol(valueNode)
        messages.push({
          file: 'agent.description',
          line,
          col,
          severity: 'warning',
          code: 'W003',
          message: 'domain still has default value "example.com"',
        })
      }
    }
    for (const child of node.children) walk(child)
  }
  walk(tree.rootNode)

  return messages
}

export async function lintBehavior(text: string): Promise<LintMessage[]> {
  await ensureWasmInit()

  _behaviorParser.setLanguage(_behaviorLang)
  const tree = _behaviorParser.parse(text)
  const messages: LintMessage[] = []

  const syntaxErrors = collectSyntaxErrors(tree.rootNode)
  if (syntaxErrors.length > 0) {
    for (const error of syntaxErrors) {
      const { line, col } = getLineCol(error)
      messages.push({
        file: 'agent.behavior',
        line,
        col,
        severity: 'error',
        code: 'E004',
        message: 'Syntax error in behavior DSL',
      })
    }
  }

  const walk = (node: Parser.SyntaxNode) => {
    if (node.type === 'text_block') {
      if (node.text.length > 280) {
        const { line, col } = getLineCol(node)
        messages.push({
          file: 'agent.behavior',
          line,
          col,
          severity: 'warning',
          code: 'W002',
          message: `Text block exceeds 280 characters (${node.text.length})`,
        })
      }
    }
    for (const child of node.children) walk(child)
  }
  walk(tree.rootNode)

  try {
    const kernel = new AgentDSLKernel()
    try {
      const effects = kernel.load_behavior(text)

      if (Array.isArray(effects)) {
        for (const effect of effects) {
          if (effect.type === 'parse_error') {
            messages.push({
              file: 'agent.behavior',
              line: 1,
              col: 1,
              severity: 'error',
              code: 'E006',
              message: `Parse error: ${effect.message}`,
            })
          }
        }
      }

      const graph = kernel.get_graph()
      if (graph?.states) {
        for (const stateName of Object.keys(graph.states)) {
          const state = graph.states[stateName]
          const hasIncoming = graph.transitions?.some((t: any) => t.to === stateName)
          const hasOutgoing = graph.transitions?.some((t: any) => t.from === stateName)

          if (!hasIncoming && !hasOutgoing && stateName !== graph.current) {
            messages.push({
              file: 'agent.behavior',
              line: 1,
              col: 1,
              severity: 'warning',
              code: 'W001',
              message: `state "${stateName}" has no transitions`,
            })
          }
        }
      }
    } catch (kernelErr: any) {
      // Kernel load failed - skip semantic checks, syntax errors already caught by tree-sitter
    }
  } catch (err: any) {
    // Could not initialize kernel - skip semantic checks
  }

  return messages
}

export async function createLinter() {
  await ensureWasmInit()

  return {
    lintDescription,
    lintBehavior,
  }
}
