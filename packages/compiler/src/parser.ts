// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

import { createRequire } from 'module'
import { Parser, Language } from 'web-tree-sitter'
import type { Node, Tree } from 'web-tree-sitter'
import type { LangId, BehaviorFile, DescriptionFile } from './types.js'
import bpInit, { parse_behavior as bpParseBehavior, parse_description as bpParseDescription, get_graph } from '@dot-agent/parser-dsl'

const require = createRequire(import.meta.url)
const { descriptionWasmPath, behaviorWasmPath } = require('@dot-agent/tree-sitter') as {
  descriptionWasmPath: string
  behaviorWasmPath: string
}

let _initialized = false
let _descriptionParser: Parser
let _behaviorParser: Parser
let _bpInitialized = false

export async function initBehaviorParser(): Promise<void> {
  if (_bpInitialized) return
  await bpInit()
  _bpInitialized = true
}

export function parseBehaviorFile(text: string): { ok: BehaviorFile } | { error: string } {
  return JSON.parse(bpParseBehavior(text)) as { ok: BehaviorFile } | { error: string }
}

export function parseDescriptionFile(text: string): { ok: DescriptionFile } | { error: string } {
  return JSON.parse(bpParseDescription(text)) as { ok: DescriptionFile } | { error: string }
}

export function getBehaviorScxml(text: string): string {
  return get_graph(text)
}

export async function initParsers(): Promise<void> {
  if (_initialized) return
  await Parser.init()
  const descriptionLang = await Language.load(descriptionWasmPath)
  const behaviorLang = await Language.load(behaviorWasmPath)
  _descriptionParser = new Parser()
  _descriptionParser.setLanguage(descriptionLang)
  _behaviorParser = new Parser()
  _behaviorParser.setLanguage(behaviorLang)
  _initialized = true
}

/**
 * Parse source text and return a tree-sitter Tree.
 *
 * @param langId  - 'description' or 'behavior'
 * @param text    - source text to parse
 * @param previousTree - optional previous tree for incremental parsing (LSP use)
 */
export async function parse(
  langId: LangId,
  text: string,
  previousTree?: Tree
): Promise<Tree> {
  await initParsers()
  const parser = langId === 'behavior' ? _behaviorParser : _descriptionParser
  return parser.parse(text, previousTree)!
}

/** Parse without initializing if parsers are already ready. Returns null if not initialized. */
export function parseSync(langId: LangId, text: string, previousTree?: Tree): Tree | null {
  if (!_initialized) return null
  const parser = langId === 'behavior' ? _behaviorParser : _descriptionParser
  return parser.parse(text, previousTree)
}

// ── AST helpers ──────────────────────────────────────────────────────────────

export function nodesOfType(tree: Tree, type: string): Node[] {
  if (!tree) return []
  return tree.rootNode.descendantsOfType(type).filter((n): n is Node => n !== null)
}

export function nodeAtOffset(tree: Tree, offset: number): Node | null {
  if (!tree) return null
  return tree.rootNode.descendantForIndex(offset)
}

export function nodeToRange(node: Node): {
  start: { line: number; character: number }
  end: { line: number; character: number }
} {
  return {
    start: { line: node.startPosition.row, character: node.startPosition.column },
    end: { line: node.endPosition.row, character: node.endPosition.column },
  }
}

export function positionToOffset(text: string, line: number, character: number): number {
  let offset = 0
  for (let i = 0; i < line; i++) {
    const nl = text.indexOf('\n', offset)
    offset = nl === -1 ? text.length : nl + 1
  }
  return offset + character
}

export function getContextNode(tree: Tree, offset: number): Node {
  let node = nodeAtOffset(tree, offset)
  while (node && (node.isError || node.isMissing)) {
    node = node.parent
  }
  if (!node || node.type === 'ERROR') {
    const raw = nodeAtOffset(tree, offset)
    const parent = raw?.parent
    if (parent) {
      const siblings = parent.children
      const idx = siblings.findIndex((c: Node | null) => c !== null && c.startIndex > offset)
      const prev = idx > 0 ? siblings[idx - 1] : siblings[siblings.length - 1]
      if (prev && !prev.isError) node = prev
    }
  }
  return node ?? tree.rootNode
}
