// SPDX-License-Identifier: Apache-2.0

import { CompletionItemKind } from 'vscode-languageserver';
import { nodesOfType, positionToOffset, getContextNode } from '../parser.js';

const BEHAVIOR_TOP_KW   = ['state', 'merge', 'on event', 'on intent', 'on offtopic'];
const BEHAVIOR_BLOCK_KW = ['guide', 'teach', 'goal', 'interact', 'run', 'transition', 'set', 'if', 'else', 'end', 'after', 'parallel', 'apply', 'remove', 'on intent', 'on offtopic', 'on failure', 'on success'];
const DESCRIPTION_TOP_KW  = ['agent', 'domain', 'license', 'terms', 'privacy', 'description', 'behavior', 'requires', 'input', 'capabilities', 'output', 'type', 'concept'];
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

export function provideCompletions(langId, tree, text, position) {
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
            return ['event', 'intent', 'offtopic', 'failure', 'success'].map(kw);
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

    if (langId === 'description') {
        if (!/^\s/.test(line)) {
            return DESCRIPTION_TOP_KW.map(kw);
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
