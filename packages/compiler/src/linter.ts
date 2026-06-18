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

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { parse, nodesOfType, parseSync, initBehaviorParser, parseFSM } from './parser.js'
import type { LintMessage } from './types.js'
import type { Node, Tree } from 'web-tree-sitter'

function nodePosition(node: Node): { line: number; col: number } {
  return { line: node.startPosition.row + 1, col: node.startPosition.column + 1 }
}

// ── Syntax error collection (reports deepest ERROR node per branch) ──────────

const MISSING_HINTS: Record<string, string> = {
  interact_stmt: "Missing 'interact' — oriented states require 'goal … interact … on intent … on offtopic'.",
  offtopic_handler: "Missing 'on offtopic' handler — every state with 'interact' must handle the offtopic case.",
  intent_handler: "Missing at least one 'on intent' handler after 'interact'.",
  goal_stmt: "Missing 'goal' — every state with 'interact' must declare a goal.",
  state_name: "Missing state name after 'state' keyword.",
  quoted_string: "Missing quoted string — expected a value in double quotes.",
}

function collectSyntaxErrors(root: Node, messages: LintMessage[], file: string): void {
  const seen = new Set<string>()

  function push(node: Node, message: string, code: string, severity: 'error' | 'warning' = 'error') {
    const key = `${node.startIndex}:${node.endIndex}:${message}`
    if (seen.has(key)) return
    seen.add(key)
    const { line, col } = nodePosition(node)
    messages.push({ file, line, col, severity, code, message })
  }

  function walk(node: Node) {
    if (node.isMissing) {
      const hint = MISSING_HINTS[node.type]
      push(node, hint ?? `Syntax error: missing '${node.type}'.`, 'E004')
      return
    }
    if (node.type === 'ERROR') {
      const hasNestedError = node.descendantsOfType('ERROR').some((e: Node | null) => e !== null && e.id !== node.id)
      if (!hasNestedError) {
        const snippet = node.text.replace(/\s+/g, ' ').trim().slice(0, 40)
        push(node, snippet ? `Syntax error near '${snippet}'.` : 'Syntax error.', 'E004')
        return
      }
    }
    for (const child of node.children) {
      if (child) walk(child)
    }
  }

  walk(root)
}

// ── Description linting ──────────────────────────────────────────────────────

const STRICT_BLOCK_TYPES: Record<string, string> = {
  input_block: 'input',
  output_block: 'output',
  requires_block: 'requires',
  capabilities_block: 'capabilities',
}

export async function lintDescription(text: string, file = 'agent.description'): Promise<LintMessage[]> {
  const tree = await parse('description', text)
  const messages: LintMessage[] = []

  collectSyntaxErrors(tree.rootNode, messages, file)

  // W003: default domain value
  // The grammar uses `agent_meta` nodes with key/value fields (not `domain_declaration`)
  for (const metaNode of nodesOfType(tree, 'agent_meta')) {
    const keyNode = metaNode.childForFieldName('key')
    if (keyNode?.text !== 'domain') continue
    const valueNode = metaNode.childForFieldName('value')
    if (valueNode?.text === 'example.com') {
      const { line, col } = nodePosition(valueNode)
      messages.push({
        file,
        line,
        col,
        severity: 'warning',
        code: 'W003',
        message: 'domain still has default value "example.com"',
      })
    }
  }

  // W007: no domain declared → agent will be packaged as unknown/name
  const hasDomain = nodesOfType(tree, 'agent_meta').some(
    n => n.childForFieldName('key')?.text === 'domain' && n.childForFieldName('value')?.text?.trim(),
  )
  if (!hasDomain) {
    messages.push({
      file,
      line: 1,
      col: 1,
      severity: 'warning',
      code: 'W007',
      message:
        'No domain declared — agent will be packaged as unknown/name. Interoperability between runtimes is not guaranteed.',
    })
  }

  // W004: undeclared type references in input/output/requires/capabilities blocks
  const declaredTypes = new Set(
    nodesOfType(tree, 'type_decl')
      .map(n => n.childForFieldName('name')?.text)
      .filter(Boolean) as string[]
  )

  if (declaredTypes.size > 0) {
    for (const blockType of Object.keys(STRICT_BLOCK_TYPES)) {
      for (const blockNode of nodesOfType(tree, blockType)) {
        for (const typeRefNode of blockNode.descendantsOfType('type_reference').filter((n): n is Node => n !== null)) {
          const idNode = typeRefNode.firstNamedChild
          if (!idNode) continue
          const typeName = idNode.text
          if (!declaredTypes.has(typeName)) {
            const { line, col } = nodePosition(idNode)
            messages.push({
              file,
              line,
              col,
              severity: 'warning',
              code: 'W004',
              message: `Type '${typeName}' is not declared in this file (assuming native or external).`,
            })
          }
        }
      }
    }
  }

  return messages
}

// ── Behavior linting ─────────────────────────────────────────────────────────

function collectTransitionTargets(stmts: Array<{ type: string; [k: string]: unknown }>): string[] {
  const targets: string[] = []
  for (const stmt of stmts) {
    if (!stmt || typeof stmt !== 'object') continue
    if (stmt.type === 'transition_stmt' && typeof stmt['state'] === 'string') {
      targets.push(stmt['state'])
    }
    if (stmt.type === 'intent_trigger' && typeof stmt['body'] === 'string') {
      targets.push(stmt['body'])
    }
    const recurse = (v: unknown) => {
      if (Array.isArray(v)) targets.push(...collectTransitionTargets(v as Array<{ type: string }>))
    }
    if (stmt.type !== 'intent_trigger') recurse(stmt['body'])
    recurse(stmt['handlers'])
    recurse(stmt['then'])
    recurse(stmt['else'])
    recurse(stmt['on_complete'])
    recurse(stmt['on_failed'])
  }
  return targets
}

function collectMergedStates(
  tree: Tree,
  docDir: string,
  states: Set<string>,
  visited = new Set<string>()
): void {
  for (const mergeNode of nodesOfType(tree, 'merge_decl')) {
    const pathNode = mergeNode.childForFieldName('path')
    if (!pathNode) continue
    const filename = pathNode.text.replace(/^"|"$/g, '')
    const absPath = resolve(docDir, filename)
    if (visited.has(absPath)) continue
    visited.add(absPath)
    let mergedText: string
    try {
      mergedText = readFileSync(absPath, 'utf-8')
    } catch {
      continue
    }
    const mergedTree = parseSync('behavior', mergedText)
    if (!mergedTree) continue
    nodesOfType(mergedTree, 'state_decl').forEach(n => {
      const name = n.childForFieldName('name')?.text
      if (name) states.add(name)
    })
    collectMergedStates(mergedTree, dirname(absPath), states, visited)
  }
}

export async function lintBehavior(
  text: string,
  file = 'agent.behavior',
  docPath?: string
): Promise<LintMessage[]> {
  await initBehaviorParser()
  const tree = await parse('behavior', text)
  const messages: LintMessage[] = []

  // Rule 0: syntax errors
  collectSyntaxErrors(tree.rootNode, messages, file)

  // E008: oriented state missing required `goal` statement
  // The grammar requires every state with `interact` to also declare a `goal`.
  for (const stateNode of nodesOfType(tree, 'state_decl')) {
    if (stateNode.hasError) continue // already reported by collectSyntaxErrors
    const hasInteract = stateNode.descendantsOfType('interact_stmt').length > 0
    const hasGoal = stateNode.descendantsOfType('goal_stmt').length > 0
    if (hasInteract && !hasGoal) {
      const nameNode = stateNode.childForFieldName('name')
      const target = nameNode ?? stateNode
      const { line, col } = nodePosition(target)
      messages.push({
        file, line, col, severity: 'error', code: 'E008',
        message: `State '${nameNode?.text ?? '?'}' uses interact but is missing a required 'goal' statement.`,
      })
    }
  }

  // W002: text content > 280 chars in goal_stmt or guide_stmt
  for (const stmtNode of [...nodesOfType(tree, 'goal_stmt'), ...nodesOfType(tree, 'guide_stmt')]) {
    const strNode = stmtNode.descendantsOfType('quoted_string').find((n): n is Node => n !== null)
    if (!strNode) continue
    const content = strNode.text.replace(/^"|"$/g, '')
    if (content.length > 280) {
      const { line, col } = nodePosition(strNode)
      messages.push({
        file,
        line,
        col,
        severity: 'warning',
        code: 'W002',
        message: `Text block exceeds 280 characters (${content.length})`,
      })
    }
  }

  // Rule 1: dangling transitions — state not defined
  const definedStates = new Set(
    nodesOfType(tree, 'state_decl')
      .map(n => n.childForFieldName('name')?.text)
      .filter(Boolean) as string[]
  )

  if (docPath) {
    try {
      collectMergedStates(tree, dirname(docPath), definedStates)
    } catch {
      // path resolution failed — continue with local states only
    }
  }

  for (const transitionNode of nodesOfType(tree, 'transition_stmt')) {
    const stateNode = transitionNode.childForFieldName('state')
    if (!stateNode) continue
    const target = stateNode.text
    if (!definedStates.has(target)) {
      const { line, col } = nodePosition(stateNode)
      const isExternal = target.includes('.')
      messages.push({
        file,
        line,
        col,
        severity: isExternal ? 'warning' : 'error',
        code: isExternal ? 'W005' : 'E005',
        message: isExternal
          ? `State '${target}' is not defined locally (assuming external flow reference).`
          : `State '${target}' is not defined in this file.`,
      })
    }
  }

  // Rule 2: dead-end interact (no handlers)
  for (const interactNode of nodesOfType(tree, 'interact_stmt')) {
    let ancestor = interactNode.parent
    while (ancestor && ancestor.type !== 'oriented_state_body' && ancestor.type !== 'state_decl') {
      ancestor = ancestor.parent
    }
    if (!ancestor) continue
    const hasHandlers =
      ancestor.descendantsOfType('intent_handler').length +
        ancestor.descendantsOfType('offtopic_handler').length >
      0
    if (!hasHandlers) {
      const { line, col } = nodePosition(interactNode)
      messages.push({
        file,
        line,
        col,
        severity: 'warning',
        code: 'W006',
        message: 'This state calls interact but has no handlers (on intent/offtopic). This will trap the agent.',
      })
    }
  }

  // Semantic FSM validation via behavior-parser
  const fsmResult = parseFSM(text)
  if ('error' in fsmResult) {
    messages.push({
      file, line: 1, col: 1, severity: 'error', code: 'E006',
      message: `Parse error: ${fsmResult.error}`,
    })
    return messages
  }

  const fsm = fsmResult.ok
  const allTargets = new Set(collectTransitionTargets(fsm.states.flatMap(s => s.body)))
  for (const state of fsm.states) {
    const hasOutgoing = collectTransitionTargets(state.body).length > 0
    const hasIncoming = allTargets.has(state.name)
    if (!hasIncoming && !hasOutgoing) {
      messages.push({
        file, line: 1, col: 1, severity: 'warning', code: 'W001',
        message: `State "${state.name}" has no transitions`,
      })
    }
  }

  return messages
}

export async function createLinter() {
  return { lintDescription, lintBehavior }
}
