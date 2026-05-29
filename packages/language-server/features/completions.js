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
const { collectStates, collectTypes } = require('../parser');

const FLOW_TOP_KW   = ['state', 'merge', 'on event', 'on intent', 'on escape', 'on fallback'];
const FLOW_BLOCK_KW = ['guide', 'teach', 'goal', 'interact', 'run', 'next', 'set', 'if', 'else', 'after', 'parallel', 'apply', 'remove', 'on intent', 'on escape', 'on fallback', 'on complete', 'on failed'];
const AGENT_TOP_KW  = ['agent', 'domain', 'license', 'terms', 'privacy', 'description', 'behavior', 'requires', 'input', 'capabilities', 'output', 'type', 'concept', 'schema'];
const STRICT_BLOCKS = new Set(['input', 'output', 'requires', 'capabilities']);

function kw(label) {
    return { label, kind: CompletionItemKind.Keyword };
}

function provideCompletions(langId, text, position) {
    const lines = text.split('\n');
    const line = lines[position.line] || '';
    const before = line.slice(0, position.character);

    if (langId === 'flow') {
        if (/\bnext\s+\S*$/.test(before)) {
            return collectStates(text).map(s => ({ label: s.name, kind: CompletionItemKind.Module, detail: 'state' }));
        }
        if (/\bset\s+\S*$/.test(before)) {
            return ['context.', 'session.', 'worksession.', 'user.'].map(d => ({ label: d, kind: CompletionItemKind.Variable, detail: 'memory domain' }));
        }
        if (/\brun\s+\S*$/.test(before)) {
            return ['script', 'subagent', 'tool'].map(kw);
        }
        if (/\bon\s+\S*$/.test(before)) {
            return ['event', 'intent', 'escape', 'fallback', 'complete', 'failed'].map(kw);
        }
        const isIndented = /^\s/.test(line);
        return (isIndented ? FLOW_BLOCK_KW : FLOW_TOP_KW).map(kw);
    }

    if (langId === 'agent') {
        if (!/^\s/.test(line)) {
            return AGENT_TOP_KW.map(kw);
        }
        // Find enclosing block
        for (let i = position.line - 1; i >= 0; i--) {
            const prev = lines[i];
            if (/^\s/.test(prev)) continue;
            const blockKw = (prev.trim().split(/\s+/)[0] || '');
            if (STRICT_BLOCKS.has(blockKw)) {
                return collectTypes(text).map(t => ({ label: t.name, kind: CompletionItemKind.Class, detail: 'type' }));
            }
            break;
        }
        return [];
    }

    return [];
}

module.exports = { provideCompletions };
