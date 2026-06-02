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

const { CompletionItemKind } = require('vscode-languageserver');
const { nodesOfType, positionToOffset, getContextNode } = require('../parser');

const BEHAVIOR_TOP_KW   = ['state', 'merge', 'on event', 'on intent', 'on offtopic', 'on fallback'];
const BEHAVIOR_BLOCK_KW = ['guide', 'teach', 'goal', 'interact', 'run', 'transition', 'set', 'if', 'else', 'after', 'parallel', 'apply', 'remove', 'on intent', 'on offtopic', 'on fallback', 'on complete', 'on failed'];
const AGENT_TOP_KW  = ['agent', 'domain', 'license', 'terms', 'privacy', 'description', 'behavior', 'requires', 'input', 'capabilities', 'output', 'type', 'concept', 'schema'];
const STRICT_BLOCKS = new Set(['input_block', 'output_block', 'requires_block', 'capabilities_block']);

function kw(label) {
    return { label, kind: CompletionItemKind.Keyword };
}

// Find the deepest non-error ancestor of a given type
function nearestAncestor(node, types) {
    let n = node;
    while (n) {
        if (types.includes(n.type)) return n;
        n = n.parent;
    }
    return null;
}

function provideCompletions(langId, tree, text, position) {
    const lines = text.split('\n');
    const line = lines[position.line] || '';
    const before = line.slice(0, position.character);

    if (langId === 'behavior') {
        // Keyword-specific completions: use prefix regex (reliable while typing)
        if (/\btransition\s+to\s+\S*$/.test(before)) {
            return nodesOfType(tree, 'state_decl')
                .map(n => n.childForFieldName('name')?.text)
                .filter(Boolean)
                .map(name => ({ label: name, kind: CompletionItemKind.Module, detail: 'state' }));
        }
        if (/\bset\s+\S*$/.test(before)) {
            return ['context.', 'session.', 'worksession.', 'user.']
                .map(d => ({ label: d, kind: CompletionItemKind.Variable, detail: 'memory domain' }));
        }
        if (/\brun\s+\S*$/.test(before)) {
            return ['script', 'subagent', 'tool'].map(kw);
        }
        if (/\bon\s+\S*$/.test(before)) {
            return ['event', 'intent', 'offtopic', 'fallback', 'complete', 'failed'].map(kw);
        }

        // Context-aware: top-level vs. inside a block
        if (tree) {
            const offset = positionToOffset(text, position.line, position.character);
            const ctx = getContextNode(tree, offset);
            const inBlock = !!nearestAncestor(ctx, ['block']);
            return (inBlock ? BEHAVIOR_BLOCK_KW : BEHAVIOR_TOP_KW).map(kw);
        }
        return (/^\s/.test(line) ? BEHAVIOR_BLOCK_KW : BEHAVIOR_TOP_KW).map(kw);
    }

    if (langId === 'agent') {
        if (!/^\s/.test(line)) {
            return AGENT_TOP_KW.map(kw);
        }

        // Inside a strict block → suggest declared types
        if (tree) {
            const offset = positionToOffset(text, position.line, position.character);
            const ctx = getContextNode(tree, offset);
            const strictBlock = nearestAncestor(ctx, [...STRICT_BLOCKS]);
            if (strictBlock) {
                return nodesOfType(tree, 'type_decl')
                    .map(n => n.childForFieldName('name')?.text)
                    .filter(Boolean)
                    .map(name => ({ label: name, kind: CompletionItemKind.Class, detail: 'type' }));
            }
        } else {
            // Fallback: text-based block detection
            for (let i = position.line - 1; i >= 0; i--) {
                const prev = lines[i];
                if (/^\s/.test(prev)) continue;
                const blockKw = (prev.trim().split(/\s+/)[0] || '');
                if (['input', 'output', 'requires', 'capabilities'].includes(blockKw)) {
                    return nodesOfType(tree, 'type_decl')
                        .map(n => n.childForFieldName('name')?.text)
                        .filter(Boolean)
                        .map(name => ({ label: name, kind: CompletionItemKind.Class, detail: 'type' }));
                }
                break;
            }
        }
        return [];
    }

    return [];
}

module.exports = { provideCompletions };
