// Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { describe, it, expect, beforeAll } from 'vitest'
import { initParsers, parse } from '../parser.js'
import { provideRenameEdits } from '../features/rename.js'

const BEHAVIOR_TEXT = `\
state init
  transition to next

state next
  transition to init
`

beforeAll(async () => { await initParsers() })

describe('provideRenameEdits — behavior', () => {
    const uri = 'file:///test.behavior'

    it('renames state declaration and all transition targets', () => {
        const tree = parse(uri, 'behavior', BEHAVIOR_TEXT, 1)
        // "next" is at line 3, char 6
        const result = provideRenameEdits('behavior', tree, BEHAVIOR_TEXT, uri, { line: 3, character: 6 }, 'renamed')
        expect(result).not.toBeNull()
        const edits = result.changes[uri]
        // 1 declaration + 1 transition target
        expect(edits).toHaveLength(2)
        expect(edits.every(e => e.newText === 'renamed')).toBe(true)
    })

    it('returns null when word is not a declared state', () => {
        const tree = parse(uri + '2', 'behavior', BEHAVIOR_TEXT, 1)
        // cursor on "transition" keyword — not a state name
        const result = provideRenameEdits('behavior', tree, BEHAVIOR_TEXT, uri + '2', { line: 1, character: 2 }, 'x')
        expect(result).toBeNull()
    })

    it('returns null for null tree', () => {
        expect(provideRenameEdits('behavior', null, '', uri, { line: 0, character: 0 }, 'x')).toBeNull()
    })
})
