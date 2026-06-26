// Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { describe, it, expect, beforeAll } from 'vitest'
import { initParsers, parse } from '../parser.js'
import { provideReferences } from '../features/references.js'

const BEHAVIOR_TEXT = `\
state init
  transition to next
  transition to next

state next
  transition to init
`

beforeAll(async () => { await initParsers() })

describe('provideReferences — behavior states', () => {
    const uri = 'file:///test.behavior'

    it('finds declaration + all transition targets for "next"', () => {
        const tree = parse(uri, 'behavior', BEHAVIOR_TEXT, 1)
        // "next" is at line 4, char 6
        const refs = provideReferences('behavior', tree, BEHAVIOR_TEXT, uri, { line: 4, character: 6 })
        // 1 declaration + 2 transition targets
        expect(refs.length).toBe(3)
    })

    it('finds declaration + one transition for "init"', () => {
        const tree = parse(uri + '2', 'behavior', BEHAVIOR_TEXT, 1)
        // "init" is at line 0, char 6
        const refs = provideReferences('behavior', tree, BEHAVIOR_TEXT, uri + '2', { line: 0, character: 6 })
        // 1 declaration + 1 transition target
        expect(refs.length).toBe(2)
    })

    it('returns empty array for null tree', () => {
        expect(provideReferences('behavior', null, '', uri, { line: 0, character: 0 })).toHaveLength(0)
    })

    it('returns empty array when word not found', () => {
        const tree = parse(uri + '3', 'behavior', BEHAVIOR_TEXT, 1)
        const refs = provideReferences('behavior', tree, BEHAVIOR_TEXT, uri + '3', { line: 1, character: 0 })
        expect(refs).toHaveLength(0)
    })
})
