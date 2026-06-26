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

import { describe, it, expect, beforeAll } from 'vitest'
import { initParsers, parse, parseSync, nodesOfType, nodeAtOffset, nodeToRange, positionToOffset } from '../src/parser.js'

const DESCRIPTION_SRC = `\
agent Doctor
  domain health.example.com
  license MIT

description
  Clinical diagnostic agent.

capabilities
  DiagnoseAction "Emit a structured diagnosis"

input Patient
output Prescription
`

const BEHAVIOR_SRC = `\
state init
  transition to responsive

state responsive
  goal "How can I help?"
  interact
  on intent "examine" transition to examine
  on intent "done" transition to init
  on offtopic transition to responsive

state examine
  goal "Review patient history."
  interact
  on intent "complete" transition to responsive
  on offtopic transition to responsive
`

const BEHAVIOR_SYNTAX_ERROR = `\
state init
  goal "Missing closing"
  transition BROKEN_TOKEN_HERE
`

beforeAll(async () => {
  await initParsers()
})

describe('initParsers / parse', () => {
  it('parses a .description file without errors', async () => {
    const tree = await parse('description', DESCRIPTION_SRC)
    expect(tree).toBeDefined()
    expect(tree.rootNode).toBeDefined()
    expect(tree.rootNode.hasError).toBe(false)
  })

  it('parses a .behavior file without errors', async () => {
    const tree = await parse('behavior', BEHAVIOR_SRC)
    expect(tree).toBeDefined()
    expect(tree.rootNode.hasError).toBe(false)
  })

  it('returns a tree with errors for malformed behavior', async () => {
    const tree = await parse('behavior', BEHAVIOR_SYNTAX_ERROR)
    expect(tree.rootNode.hasError).toBe(true)
  })

  it('accepts previousTree for incremental parsing', async () => {
    // Incremental reuse requires tree.edit() for insertions; here we verify that
    // passing previousTree on an unchanged re-parse produces the correct result.
    const first = await parse('behavior', BEHAVIOR_SRC)
    const second = await parse('behavior', BEHAVIOR_SRC, first)
    expect(second.rootNode.hasError).toBe(false)
    expect(nodesOfType(second, 'state_decl')).toHaveLength(3)
  })
})

describe('parseSync', () => {
  it('returns a tree when parsers are initialized', () => {
    const tree = parseSync('behavior', BEHAVIOR_SRC)
    expect(tree).not.toBeNull()
    expect(tree!.rootNode.hasError).toBe(false)
  })
})

describe('nodesOfType', () => {
  it('finds all state_decl nodes in a behavior', async () => {
    const tree = await parse('behavior', BEHAVIOR_SRC)
    const states = nodesOfType(tree, 'state_decl')
    expect(states).toHaveLength(3)
    const names = states.map(n => n.childForFieldName('name')?.text)
    expect(names).toContain('init')
    expect(names).toContain('responsive')
    expect(names).toContain('examine')
  })

  it('finds all transition_stmt nodes', async () => {
    const tree = await parse('behavior', BEHAVIOR_SRC)
    const transitions = nodesOfType(tree, 'transition_stmt')
    expect(transitions.length).toBeGreaterThanOrEqual(3)
  })
})

describe('nodeAtOffset', () => {
  it('returns a node at the given byte offset', async () => {
    const tree = await parse('behavior', BEHAVIOR_SRC)
    // offset 6 is inside "state init" — within the keyword or the state name
    const node = nodeAtOffset(tree, 6)
    expect(node).not.toBeNull()
  })
})

describe('nodeToRange', () => {
  it('converts a node to an LSP-style range', async () => {
    const tree = await parse('behavior', BEHAVIOR_SRC)
    const states = nodesOfType(tree, 'state_decl')
    const range = nodeToRange(states[0])
    expect(range.start).toHaveProperty('line')
    expect(range.start).toHaveProperty('character')
    expect(range.end).toHaveProperty('line')
    expect(range.end).toHaveProperty('character')
    expect(range.start.line).toBe(0)
  })
})

describe('positionToOffset', () => {
  it('converts line 0 char 0 to offset 0', () => {
    expect(positionToOffset(BEHAVIOR_SRC, 0, 0)).toBe(0)
  })

  it('converts line 1 to offset past the first newline', () => {
    const offset = positionToOffset(BEHAVIOR_SRC, 1, 0)
    expect(BEHAVIOR_SRC[offset - 1]).toBe('\n')
  })

  it('handles character offset within a line', () => {
    const line = BEHAVIOR_SRC.split('\n')[0]
    const offset = positionToOffset(BEHAVIOR_SRC, 0, 5)
    expect(offset).toBe(5)
    expect(BEHAVIOR_SRC[offset]).toBe(line[5])
  })
})
