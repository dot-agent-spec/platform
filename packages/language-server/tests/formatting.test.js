// Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { describe, it, expect } from 'vitest'
import { format } from '../features/formatting.js'

// ── behavior formatting ───────────────────────────────────────────────────────

describe('format — behavior', () => {
    it('returns no edits for already-correct indentation', () => {
        const text = [
            'state init',
            '  goal "hello"',
            '  interact',
            '  on intent "go" transition to next',
            '  on offtopic transition to init',
            '',
            'state next',
            '  guide "done"',
        ].join('\n')
        expect(format('behavior', text)).toHaveLength(0)
    })

    it('fixes over-indented state declaration', () => {
        const text = '  state init\n  goal "hi"'
        const edits = format('behavior', text)
        const stateFix = edits.find(e => e.range.start.line === 0)
        expect(stateFix).toBeDefined()
        expect(stateFix.newText).toBe('')
    })

    it('fixes missing indentation inside state body', () => {
        const text = 'state init\nguide "hello"'
        const edits = format('behavior', text)
        const guideFix = edits.find(e => e.range.start.line === 1)
        expect(guideFix).toBeDefined()
        expect(guideFix.newText).toBe('  ')
    })

    it('produces no edits for empty text', () => {
        expect(format('behavior', '')).toHaveLength(0)
    })

    it('produces no edits for blank lines', () => {
        expect(format('behavior', '\n\n\n')).toHaveLength(0)
    })
})

// ── description formatting ────────────────────────────────────────────────────

describe('format — description', () => {
    it('returns no edits for already-correct indentation', () => {
        const text = 'agent Doctor\n  domain example.com\n  license MIT'
        expect(format('description', text)).toHaveLength(0)
    })

    it('fixes wrong indent on line starting with space (3→2)', () => {
        // 3 spaces → starts with space → expectedIndent=2 → fix to 2
        const text = '   agent Doctor\n  domain example.com'
        const edits = format('description', text)
        const fix = edits.find(e => e.range.start.line === 0)
        expect(fix).toBeDefined()
        expect(fix.newText).toBe('  ')
    })

    it('fixes wrong indent on nested property (4→2)', () => {
        // 4 spaces → starts with space → expectedIndent=2 → fix to 2
        const text = 'agent Doctor\n    domain example.com'
        const edits = format('description', text)
        const fix = edits.find(e => e.range.start.line === 1)
        expect(fix).toBeDefined()
        expect(fix.newText).toBe('  ')
    })
})

// ── unknown langId ────────────────────────────────────────────────────────────

describe('format — unknown langId', () => {
    it('returns empty array', () => {
        expect(format('unknown', 'anything')).toHaveLength(0)
    })
})
