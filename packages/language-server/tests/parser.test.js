// Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { describe, it, expect, beforeAll } from 'vitest'
import {
    initParsers,
    parse,
    evict,
    nodesOfType,
    nodeAtOffset,
    nodeToRange,
    positionToOffset,
    wordAtPosition,
    getContextNode,
} from '../parser.js'

// transition-only state bodies are the safest valid fixture
const BEHAVIOR_TEXT = `\
state init
  transition to next

state next
  transition to init
`

const DESCRIPTION_TEXT = `\
agent Doctor
  domain health.example.com
  license MIT

description
  Clinical diagnostic agent.

input Patient
output Prescription
`

beforeAll(async () => {
    await initParsers()
})

// ── parse + cache ─────────────────────────────────────────────────────────────

describe('parse', () => {
    it('parses behavior text and returns a tree', () => {
        const tree = parse('uri:test.behavior', 'behavior', BEHAVIOR_TEXT, 1)
        expect(tree).not.toBeNull()
        expect(tree.rootNode.type).toBe('behavior_file')
    })

    it('returns the cached tree for the same version', () => {
        const t1 = parse('uri:cached.behavior', 'behavior', BEHAVIOR_TEXT, 1)
        const t2 = parse('uri:cached.behavior', 'behavior', BEHAVIOR_TEXT, 1)
        expect(t1).toBe(t2)
    })

    it('reparses when version changes', () => {
        const t1 = parse('uri:versioned.behavior', 'behavior', BEHAVIOR_TEXT, 1)
        const t2 = parse('uri:versioned.behavior', 'behavior', BEHAVIOR_TEXT + '\n', 2)
        expect(t1).not.toBe(t2)
    })

    it('parses description text', () => {
        const tree = parse('uri:test.description', 'description', DESCRIPTION_TEXT, 1)
        expect(tree).not.toBeNull()
        expect(tree.rootNode.type).toBe('manifest')
    })

    it('returns no parse errors for valid behavior', () => {
        const tree = parse('uri:valid.behavior', 'behavior', BEHAVIOR_TEXT, 2)
        expect(tree.rootNode.hasError).toBe(false)
    })

    // Regression: parse() used to hand the previous version's tree to
    // tree-sitter as an incremental-reuse hint without ever calling
    // tree.edit() first, which tree-sitter requires to keep node byte ranges
    // valid. Without it, node.text silently returns garbled/truncated
    // strings after an edit shifts content — surfaced as "name must not be
    // falsy" when the language server converted a corrupted state name to a
    // DocumentSymbol.
    it('does not corrupt node text across an edit at the same uri', () => {
        const uri = 'uri:edited.behavior'
        parse(uri, 'behavior', BEHAVIOR_TEXT, 1)
        const editedText = 'state prepended\n  transition to init\n\n' + BEHAVIOR_TEXT
        const tree = parse(uri, 'behavior', editedText, 2)
        const names = nodesOfType(tree, 'state_decl').map(n => n.childForFieldName('name')?.text)
        expect(names).toEqual(['prepended', 'init', 'next'])
        expect(names.every(n => n && n.length > 0)).toBe(true)
    })
})

// ── evict ─────────────────────────────────────────────────────────────────────

describe('evict', () => {
    it('removes cached tree so next parse re-builds', () => {
        const uri = 'uri:evict-test.behavior'
        const t1 = parse(uri, 'behavior', BEHAVIOR_TEXT, 1)
        evict(uri)
        const t2 = parse(uri, 'behavior', BEHAVIOR_TEXT, 1)
        // After evict, same version → new tree object
        expect(t1).not.toBe(t2)
    })
})

// ── nodesOfType ───────────────────────────────────────────────────────────────

describe('nodesOfType', () => {
    it('returns all state_decl nodes from a behavior tree', () => {
        const tree = parse('uri:nodes.behavior', 'behavior', BEHAVIOR_TEXT, 1)
        const states = nodesOfType(tree, 'state_decl')
        expect(states.length).toBe(2)
        expect(states.map(n => n.childForFieldName('name')?.text)).toEqual(['init', 'next'])
    })

    it('returns empty array for unknown node type', () => {
        const tree = parse('uri:nodes2.behavior', 'behavior', BEHAVIOR_TEXT, 1)
        expect(nodesOfType(tree, 'nonexistent_node')).toHaveLength(0)
    })

    it('returns empty array for null tree', () => {
        expect(nodesOfType(null, 'state_decl')).toHaveLength(0)
    })

    it('returns agent_decl from description tree', () => {
        const tree = parse('uri:desc-nodes.description', 'description', DESCRIPTION_TEXT, 1)
        const agents = nodesOfType(tree, 'agent_decl')
        expect(agents.length).toBe(1)
        expect(agents[0].childForFieldName('name')?.text).toBe('Doctor')
    })
})

// ── nodeToRange ───────────────────────────────────────────────────────────────

describe('nodeToRange', () => {
    it('converts a node to an LSP range', () => {
        const tree = parse('uri:range.behavior', 'behavior', BEHAVIOR_TEXT, 1)
        const [firstState] = nodesOfType(tree, 'state_decl')
        const range = nodeToRange(firstState)
        expect(range.start.line).toBe(0)
        expect(range.start.character).toBe(0)
        expect(range.end.line).toBeGreaterThanOrEqual(1)
    })
})

// ── positionToOffset ──────────────────────────────────────────────────────────

describe('positionToOffset', () => {
    it('returns 0 for line 0 character 0', () => {
        expect(positionToOffset('hello\nworld', 0, 0)).toBe(0)
    })

    it('returns correct offset for line 1', () => {
        expect(positionToOffset('hello\nworld', 1, 0)).toBe(6)
    })

    it('returns correct offset for mid-line character', () => {
        expect(positionToOffset('hello\nworld', 0, 3)).toBe(3)
    })
})

// ── wordAtPosition ────────────────────────────────────────────────────────────

describe('wordAtPosition', () => {
    it('extracts identifier at cursor inside word', () => {
        const { word } = wordAtPosition('  transition to init', 0, 5)
        expect(word).toBe('transition')
    })

    it('extracts dotted identifier', () => {
        const { word } = wordAtPosition('set context.name', 0, 6)
        expect(word).toBe('context.name')
    })

    it('extracts word when cursor is at a boundary between word and space', () => {
        // At "state init", ch=5 (the space) — walks back into "state"
        const { word } = wordAtPosition('state init', 0, 5)
        expect(word).toBe('state')
    })

    it('returns empty string when cursor is before any word character', () => {
        const { word } = wordAtPosition('  state init', 0, 0)
        expect(word).toBe('')
    })
})

// ── nodeAtOffset ──────────────────────────────────────────────────────────────

describe('nodeAtOffset', () => {
    it('returns a node at the given byte offset', () => {
        const tree = parse('uri:offset.behavior', 'behavior', BEHAVIOR_TEXT, 1)
        const node = nodeAtOffset(tree, 0)
        expect(node).not.toBeNull()
    })

    it('returns null for null tree', () => {
        expect(nodeAtOffset(null, 0)).toBeNull()
    })
})

// ── getContextNode ────────────────────────────────────────────────────────────

describe('getContextNode', () => {
    it('returns a non-error node for valid position', () => {
        const tree = parse('uri:ctx.behavior', 'behavior', BEHAVIOR_TEXT, 1)
        const offset = positionToOffset(BEHAVIOR_TEXT, 0, 6)
        const node = getContextNode(tree, offset)
        expect(node).not.toBeNull()
        expect(node.isError).toBeFalsy()
    })
})
