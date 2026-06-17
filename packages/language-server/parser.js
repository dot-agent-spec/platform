/*
 * Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const path = require('path');
const { Parser, Language } = require('web-tree-sitter');
const grammar = require('@dot-agent/tree-sitter');

// path.resolve ensures absolute paths survive vsix packaging and cwd changes
const DESCRIPTION_WASM = path.resolve(grammar.agentWasmPath);
const BEHAVIOR_WASM  = path.resolve(grammar.behaviorWasmPath);

let descriptionParser, behaviorParser;

async function initParsers() {
    await Parser.init();
    const DescriptionLang = await Language.load(DESCRIPTION_WASM);
    const Behavior  = await Language.load(BEHAVIOR_WASM);
    descriptionParser = new Parser();
    descriptionParser.setLanguage(DescriptionLang);
    behaviorParser = new Parser();
    behaviorParser.setLanguage(Behavior);
}

// Cache: uri → { version, tree }
const cache = new Map();

function parse(uri, langId, text, version) {
    const prev = cache.get(uri);
    if (prev?.version === version) return prev.tree;
    const parser = langId === 'behavior' ? behaviorParser : descriptionParser;
    if (!parser) return null;
    const tree = parser.parse(text, prev?.tree);   // incremental reuse when possible
    cache.set(uri, { version, tree });
    return tree;
}

function evict(uri) {
    cache.delete(uri);
}

function parseText(langId, text) {
    const parser = langId === 'behavior' ? behaviorParser : descriptionParser;
    if (!parser) return null;
    return parser.parse(text);
}

// ── AST helpers ──────────────────────────────────────────────────────────────

function nodesOfType(tree, type) {
    if (!tree) return [];
    return tree.rootNode.descendantsOfType(type);
}

function nodeAtOffset(tree, offset) {
    if (!tree) return null;
    return tree.rootNode.descendantForIndex(offset);
}

// Convert a tree-sitter {row, column} position to an LSP Range
function nodeToRange(node) {
    return {
        start: { line: node.startPosition.row, character: node.startPosition.column },
        end:   { line: node.endPosition.row,   character: node.endPosition.column },
    };
}

// Convert LSP position (line, character) to a byte offset in text
function positionToOffset(text, line, character) {
    let offset = 0;
    for (let i = 0; i < line; i++) {
        const nl = text.indexOf('\n', offset);
        offset = nl === -1 ? text.length : nl + 1;
    }
    return offset + character;
}

// Extract the word (identifier chars including dots) around position
function wordAtPosition(text, line, character) {
    const lines = text.split('\n');
    const lineText = lines[line] || '';
    let start = character, end = character;
    while (start > 0 && /[a-zA-Z0-9_.]/.test(lineText[start - 1])) start--;
    while (end < lineText.length && /[a-zA-Z0-9_.]/.test(lineText[end])) end++;
    return { word: lineText.slice(start, end), start, end };
}

// Walk up the tree from offset, skipping ERROR/MISSING nodes
function getContextNode(tree, offset) {
    let node = nodeAtOffset(tree, offset);
    while (node && (node.isError || node.isMissing)) {
        node = node.parent;
    }
    // If still on an error, try the previous sibling's last descendant
    if (!node || node.type === 'ERROR') {
        const raw = nodeAtOffset(tree, offset);
        const parent = raw?.parent;
        if (parent) {
            const siblings = parent.children;
            const idx = siblings.findIndex(c => c.startIndex > offset);
            const prev = idx > 0 ? siblings[idx - 1] : siblings[siblings.length - 1];
            if (prev && !prev.isError) node = prev;
        }
    }
    return node ?? tree?.rootNode;
}

module.exports = {
    initParsers,
    parse,
    parseText,
    evict,
    nodesOfType,
    nodeAtOffset,
    nodeToRange,
    positionToOffset,
    wordAtPosition,
    getContextNode,
};
