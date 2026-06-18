// Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { describe, it, expect } from 'vitest'
import { provideHover } from '../features/hover.js'

// ── behavior keywords ─────────────────────────────────────────────────────────

describe('provideHover — behavior', () => {
    it('returns docs for "state" keyword', () => {
        const result = provideHover('behavior', 'state init', { line: 0, character: 2 })
        expect(result).not.toBeNull()
        expect(result.contents.value).toMatch(/state/)
    })

    it('returns docs for "goal" keyword', () => {
        const result = provideHover('behavior', '  goal "help"', { line: 0, character: 4 })
        expect(result).not.toBeNull()
        expect(result.contents.value).toMatch(/goal/)
    })

    it('returns docs for "interact" keyword', () => {
        const result = provideHover('behavior', '  interact', { line: 0, character: 4 })
        expect(result).not.toBeNull()
        expect(result.contents.value).toMatch(/interact/)
    })

    it('returns docs for "transition" keyword', () => {
        const result = provideHover('behavior', '  transition to next', { line: 0, character: 5 })
        expect(result).not.toBeNull()
        expect(result.contents.value).toMatch(/transition/)
    })

    it('returns docs for "merge" keyword', () => {
        const result = provideHover('behavior', 'merge "base.behavior"', { line: 0, character: 2 })
        expect(result).not.toBeNull()
        expect(result.contents.value).toMatch(/merge/)
    })

    it('returns docs for "teach" keyword', () => {
        const result = provideHover('behavior', '  teach "file.md"', { line: 0, character: 3 })
        expect(result).not.toBeNull()
        expect(result.contents.value).toMatch(/teach/)
    })

    it('returns null for unknown word', () => {
        const result = provideHover('behavior', '  unknownkeyword', { line: 0, character: 5 })
        expect(result).toBeNull()
    })

    it('returns null for empty position', () => {
        const result = provideHover('behavior', '  ', { line: 0, character: 0 })
        expect(result).toBeNull()
    })
})

// ── description keywords ──────────────────────────────────────────────────────

describe('provideHover — description', () => {
    it('returns docs for "agent" keyword', () => {
        const result = provideHover('description', 'agent Doctor', { line: 0, character: 2 })
        expect(result).not.toBeNull()
        expect(result.contents.value).toMatch(/agent/)
    })

    it('returns docs for "domain" keyword', () => {
        const result = provideHover('description', '  domain example.com', { line: 0, character: 4 })
        expect(result).not.toBeNull()
        expect(result.contents.value).toMatch(/domain/)
    })

    it('returns docs for "type" keyword', () => {
        const result = provideHover('description', 'type Patient', { line: 0, character: 2 })
        expect(result).not.toBeNull()
        expect(result.contents.value).toMatch(/type/)
    })

    it('returns null for behavior-only keyword in description mode', () => {
        const result = provideHover('description', 'state init', { line: 0, character: 2 })
        expect(result).toBeNull()
    })
})
