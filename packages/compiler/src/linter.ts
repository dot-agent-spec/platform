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
import { parse, nodesOfType, parseSync, initBehaviorParser, parseBehaviorFile } from './parser.js'
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

  // E017: multiple behavior declarations
  const behaviorBlocks = nodesOfType(tree, 'behavior_block')
  if (behaviorBlocks.length > 1) {
    const { line, col } = nodePosition(behaviorBlocks[1])
    messages.push({
      file, line, col, severity: 'error', code: 'E017',
      message: "Multiple 'behavior' declarations — only one is allowed. To combine multiple files, use 'merge' in your .behavior file.",
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

function levenshtein(a: string, b: string): number {
  const la = a.length, lb = b.length
  const dp: number[][] = Array.from({ length: la + 1 }, (_, i) =>
    Array.from({ length: lb + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[la][lb]
}

function closestName(token: string, candidates: string[]): string | undefined {
  let best: string | undefined
  let bestDist = Infinity
  for (const name of candidates) {
    const d = levenshtein(token.toLowerCase(), name.toLowerCase())
    if (d > 0 && d <= 2 && d < bestDist) { bestDist = d; best = name }
  }
  return best
}

const KERNEL_LIFECYCLE_NAMES = ['init', 'welcome', 'end', 'online', 'offline']

function collectTransitionTargets(stmts: Array<{ type: string; [k: string]: unknown }>): string[] {
  const targets: string[] = []
  for (const stmt of stmts) {
    if (!stmt || typeof stmt !== 'object') continue
    if (stmt.type === 'transition_stmt' && typeof stmt['state'] === 'string') {
      targets.push(stmt['state'])
    }
    if (stmt.type === 'intent_handler' && typeof stmt['body'] === 'string') {
      targets.push(stmt['body'])
    }
    const recurse = (v: unknown) => {
      if (Array.isArray(v)) targets.push(...collectTransitionTargets(v as Array<{ type: string }>))
    }
    if (stmt.type !== 'intent_handler') recurse(stmt['body'])
    recurse(stmt['handlers'])
    recurse(stmt['then'])
    recurse(stmt['else'])
    recurse(stmt['on_complete'])
    recurse(stmt['on_failure'])
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
  docPath?: string,
  consolidated = false,
): Promise<LintMessage[]> {
  await initBehaviorParser()
  if (!text.endsWith('\n')) text = text + '\n'
  const tree = await parse('behavior', text)
  const messages: LintMessage[] = []

  // Rule 0: syntax errors
  collectSyntaxErrors(tree.rootNode, messages, file)

  for (const stateNode of nodesOfType(tree, 'state_decl')) {
    if (stateNode.hasError) continue
    const nameNode = stateNode.childForFieldName('name')
    const stateName = nameNode?.text ?? '?'
    const hasInteract = stateNode.descendantsOfType('interact_stmt').length > 0
    const hasGoal = stateNode.descendantsOfType('goal_stmt').length > 0
    const intentHandlers = stateNode.descendantsOfType('intent_handler')

    // W013: interact without goal (supersedes E008 — downgraded to warning)
    if (hasInteract && !hasGoal) {
      const { line, col } = nodePosition(nameNode ?? stateNode)
      messages.push({
        file, line, col, severity: 'warning', code: 'W013',
        message: `'interact' without 'goal' — the prettifier will insert one. To set it explicitly, add 'goal "..."' before 'interact'.`,
      })
    }

    // W012: goal without interact
    if (hasGoal && !hasInteract) {
      const { line, col } = nodePosition(nameNode ?? stateNode)
      messages.push({
        file, line, col, severity: 'warning', code: 'W012',
        message: `'goal' is only valid in an oriented state. Add 'interact' or remove 'goal' — the prettifier can adjust this.`,
      })
    }

    // E009: oriented state with no on intent handlers
    if (hasInteract && intentHandlers.length === 0) {
      const { line, col } = nodePosition(nameNode ?? stateNode)
      messages.push({
        file, line, col, severity: 'error', code: 'E009',
        message: `Oriented state '${stateName}' has no 'on intent' handlers. At least one is required.`,
      })
    }

    // W008: duplicate on intent label in same state (Error-level per spec)
    const seenIntents = new Map<string, true>()
    for (const handler of intentHandlers) {
      const intentNode = handler.childForFieldName('intent')
      if (!intentNode) continue
      const label = intentNode.text.replace(/^"|"$/g, '')
      if (seenIntents.has(label)) {
        const { line, col } = nodePosition(handler)
        messages.push({
          file, line, col, severity: 'error', code: 'W008',
          message: `Duplicate 'on intent "${label}"' in state '${stateName}'. The FSM cannot route ambiguous intents — use a unique label for each handler.`,
        })
      } else {
        seenIntents.set(label, true)
      }
    }

    // W011: on intent handler transitions to its own enclosing state
    for (const handler of intentHandlers) {
      for (const t of handler.descendantsOfType('transition_stmt')) {
        const targetNode = t.childForFieldName('state')
        if (targetNode?.text === stateName) {
          const { line, col } = nodePosition(handler)
          messages.push({
            file, line, col, severity: 'warning', code: 'W011',
            message: `'on intent' handler in state '${stateName}' transitions back to itself. The user expressed an intent but receives no progress — did you mean a different target state?`,
          })
        }
      }
    }

    // I001/I002: state overrides kernel lifecycle
    if (stateName === 'init' || stateName === 'end') {
      const { line, col } = nodePosition(nameNode ?? stateNode)
      if (stateName === 'init') {
        messages.push({
          file, line, col, severity: 'info', code: 'I001',
          message: `State 'init' overrides the kernel's default entry lifecycle. The kernel will use this definition instead of its built-in init sequence.`,
        })
      } else {
        messages.push({
          file, line, col, severity: 'info', code: 'I002',
          message: `State 'end' overrides the kernel's default terminal lifecycle. The kernel will treat this state as the canonical exit point.`,
        })
      }
    }

    // H001: state name close to (but not exact match of) kernel lifecycle names
    if (!KERNEL_LIFECYCLE_NAMES.includes(stateName)) {
      const closest = closestName(stateName, KERNEL_LIFECYCLE_NAMES)
      if (closest) {
        const { line, col } = nodePosition(nameNode ?? stateNode)
        messages.push({
          file, line, col, severity: 'hint', code: 'H001',
          message: `State name '${stateName}' resembles the kernel lifecycle name '${closest}'. If this is intentional, ignore this hint.`,
        })
      }
    }
  }

  // E010: parallel block with no run statements
  for (const parallelNode of nodesOfType(tree, 'parallel_stmt')) {
    if (parallelNode.hasError) continue
    if (parallelNode.descendantsOfType('run_stmt').length === 0) {
      const { line, col } = nodePosition(parallelNode)
      let stateName = '?'
      let ancestor = parallelNode.parent
      while (ancestor && ancestor.type !== 'state_decl') ancestor = ancestor.parent
      if (ancestor) stateName = ancestor.childForFieldName('name')?.text ?? '?'
      messages.push({
        file, line, col, severity: 'warning', code: 'E010',
        message: `'parallel' block in state '${stateName}' has no 'run' statements and does nothing.`,
      })
    }
  }

  // E011: after statement with prompts: 0
  for (const afterNode of nodesOfType(tree, 'after_stmt')) {
    if (afterNode.hasError) continue
    const countNode = afterNode.childForFieldName('count')
    if (countNode?.text === '0') {
      const { line, col } = nodePosition(countNode)
      messages.push({
        file, line, col, severity: 'error', code: 'E011',
        message: `'after 0' is invalid — prompts must be ≥ 1. Use 'after 1' for the next prompt.`,
      })
    }
  }

  // W002: goal_stmt text > 280 chars
  for (const stmtNode of nodesOfType(tree, 'goal_stmt')) {
    const strNode = stmtNode.descendantsOfType('quoted_string').find((n): n is Node => n !== null)
    if (!strNode) continue
    const content = strNode.text.replace(/^"|"$/g, '')
    if (content.length > 280) {
      const { line, col } = nodePosition(strNode)
      messages.push({
        file, line, col, severity: 'warning', code: 'W002',
        message: `Text block exceeds 280 characters (${content.length}). Consider using 'teach' to load long goal text from an external file.`,
      })
    }
  }

  // W010: guide_stmt text > 280 chars
  for (const stmtNode of nodesOfType(tree, 'guide_stmt')) {
    const strNode = stmtNode.descendantsOfType('quoted_string').find((n): n is Node => n !== null)
    if (!strNode) continue
    const content = strNode.text.replace(/^"|"$/g, '')
    if (content.length > 280) {
      const { line, col } = nodePosition(strNode)
      let p = stmtNode.parent
      while (p && p.type !== 'state_decl') p = p.parent
      const stateName = p?.childForFieldName('name')?.text ?? '?'
      messages.push({
        file, line, col, severity: 'warning', code: 'W010',
        message: `'guide' text in state '${stateName}' is ${content.length} characters (limit: 280). Consider using an external file.`,
      })
    }
  }

  // E005/W005: dangling transitions — state not defined (H002: hint with closest name)
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

  const stateNameList = Array.from(definedStates)
  for (const transitionNode of nodesOfType(tree, 'transition_stmt')) {
    const stateNode = transitionNode.childForFieldName('state')
    if (!stateNode) continue
    const target = stateNode.text
    if (!definedStates.has(target)) {
      const { line, col } = nodePosition(stateNode)
      const isExternal = target.includes('.')
      // H002: enrich E005 with closest state name suggestion
      const hint = !isExternal ? closestName(target, stateNameList) : undefined
      messages.push({
        file, line, col,
        severity: isExternal ? 'warning' : 'error',
        code: isExternal ? 'W005' : 'E005',
        message: isExternal
          ? `State '${target}' is not defined locally (assuming external flow reference).`
          : `State '${target}' is not defined in this file.`,
        ...(hint ? { hint: `did you mean '${hint}'?` } : {}),
      })
    }
  }

  // W006: dead-end interact (no handlers at all)
  for (const interactNode of nodesOfType(tree, 'interact_stmt')) {
    let ancestor = interactNode.parent
    while (ancestor && ancestor.type !== 'state_decl') ancestor = ancestor.parent
    if (!ancestor) continue
    const hasHandlers =
      ancestor.descendantsOfType('intent_handler').length +
        ancestor.descendantsOfType('offtopic_handler').length > 0
    if (!hasHandlers) {
      const { line, col } = nodePosition(interactNode)
      messages.push({
        file, line, col, severity: 'warning', code: 'W006',
        message: 'This state calls interact but has no handlers (on intent/offtopic). This will trap the agent.',
      })
    }
  }

  // Semantic FSM validation via behavior-parser WASM
  const fsmResult = parseBehaviorFile(text)
  if (fsmResult.ok === null) {
    const firstMsg = fsmResult.diagnostics[0]?.message ?? 'Parse error'
    messages.push({
      file, line: 1, col: 1, severity: 'error', code: 'E006',
      message: `Parse error: ${firstMsg}`,
    })
    return messages
  }

  const fsm = fsmResult.ok
  const allTargets = new Set(collectTransitionTargets(fsm.states.flatMap(s => s.body)))

  // W001: isolated state (no incoming and no outgoing transitions)
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

  // W009: unreachable state (no incoming transitions, not the first state)
  for (let i = 1; i < fsm.states.length; i++) {
    const state = fsm.states[i]
    if (!allTargets.has(state.name)) {
      const stateNode = nodesOfType(tree, 'state_decl')
        .find(n => n.childForFieldName('name')?.text === state.name)
      const pos = stateNode ? nodePosition(stateNode) : { line: 1, col: 1 }
      messages.push({
        file, line: pos.line, col: pos.col, severity: 'warning', code: 'W009',
        message: `State '${state.name}' is unreachable — no other state transitions to it.`,
      })
    }
  }

  if (consolidated) {
    // E015: duplicate state name across merged files
    const seenStates = new Set<string>()
    for (const state of fsm.states) {
      if (seenStates.has(state.name)) {
        messages.push({
          file, line: 1, col: 1, severity: 'error', code: 'E015',
          message: `Duplicate state '${state.name}' across merged files — each state name must be unique in the consolidated FSM.`,
        })
      } else {
        seenStates.add(state.name)
      }
    }

    // E016: init state missing
    if (!fsm.states.some(s => s.name === 'init')) {
      messages.push({
        file, line: 1, col: 1, severity: 'error', code: 'E016',
        message: `Required 'init' state is missing. Add a state named 'init' as the entry point of your behavior.`,
      })
    }

    // W014: duplicate global trigger event across merged files
    const seenTriggers = new Set<string>()
    for (const trigger of fsm.global_triggers) {
      if (seenTriggers.has(trigger.event)) {
        messages.push({
          file, line: 1, col: 1, severity: 'warning', code: 'W014',
          message: `Duplicate global trigger '${trigger.event}' across merged files — only the last definition takes effect.`,
        })
      } else {
        seenTriggers.add(trigger.event)
      }
    }
  }

  return messages
}

export async function createLinter() {
  return { lintDescription, lintBehavior }
}
