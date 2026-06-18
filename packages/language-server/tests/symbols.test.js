// Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { describe, it, expect, beforeAll } from 'vitest'
import { initParsers, parse } from '../parser.js'
import { provideDocumentSymbols } from '../features/symbols.js'

const BEHAVIOR_TEXT = `\
on event "start"
  transition to init

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
`

beforeAll(async () => { await initParsers() })

describe('provideDocumentSymbols — behavior', () => {
    it('returns all state_decl as Class symbols', () => {
        const tree = parse('uri:sym.behavior', 'behavior', BEHAVIOR_TEXT, 1)
        const symbols = provideDocumentSymbols('behavior', tree)
        const states = symbols.filter(s => s.kind === 5) // Class
        expect(states.map(s => s.name)).toEqual(['init', 'next'])
    })

    it('returns trigger_decl as Event symbol', () => {
        const tree = parse('uri:sym2.behavior', 'behavior', BEHAVIOR_TEXT, 1)
        const symbols = provideDocumentSymbols('behavior', tree)
        const events = symbols.filter(s => s.kind === 24) // Event
        expect(events).toHaveLength(1)
        expect(events[0].name).toMatch(/start/)
    })

    it('returns empty array for null tree', () => {
        expect(provideDocumentSymbols('behavior', null)).toHaveLength(0)
    })
})

describe('provideDocumentSymbols — description', () => {
    it('returns agent_decl as Class symbol', () => {
        const tree = parse('uri:sym.description', 'description', DESCRIPTION_TEXT, 1)
        const symbols = provideDocumentSymbols('description', tree)
        const agents = symbols.filter(s => s.kind === 5)
        expect(agents).toHaveLength(1)
        expect(agents[0].name).toBe('Doctor')
    })

    it('returns empty array for null tree', () => {
        expect(provideDocumentSymbols('description', null)).toHaveLength(0)
    })
})
