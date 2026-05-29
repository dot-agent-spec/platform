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

const { DiagnosticSeverity } = require('vscode-languageserver');
const { collectStates, collectTypes, offsetToPosition } = require('../parser');

const DEPRECATED_AGENT_KW = new Set(['do', 'server', 'endpoint', 'author', 'version', 'requirements', 'step', 'softwareVersion', 'applicationCategory', 'character', 'publishingPrinciples']);
const STRICT_BLOCKS = new Set(['input', 'output', 'requires', 'capabilities']);

function diagnoseAgent(text) {
    const diagnostics = [];
    const lines = text.split('\n');
    const declaredTypes = new Set(collectTypes(text).map(t => t.name));
    let currentBlock = null;

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const stripped = raw.split('//')[0].trim();
        if (!stripped) continue;
        const wordM = stripped.match(/^([a-zA-Z0-9_.-]+)\b/);
        if (!wordM) continue;
        const word = wordM[1];

        if (DEPRECATED_AGENT_KW.has(word)) {
            const col = raw.indexOf(word);
            diagnostics.push({
                range: { start: { line: i, character: col }, end: { line: i, character: col + word.length } },
                message: `The keyword '${word}' is deprecated or invalid in the current .agent specification.`,
                severity: DiagnosticSeverity.Error,
                source: 'agent-dsl',
            });
        }

        const isIndented = raw.startsWith('  ') || raw.startsWith('\t');
        if (!isIndented) {
            currentBlock = word;
            if (STRICT_BLOCKS.has(word)) {
                const remainder = stripped.slice(word.length).trim();
                if (remainder && !/^([a-zA-Z0-9_.-]+)(\s*,\s*[a-zA-Z0-9_.-]+)*$/.test(remainder)) {
                    const col = raw.indexOf(remainder);
                    diagnostics.push({
                        range: { start: { line: i, character: col }, end: { line: i, character: col + remainder.length } },
                        message: 'Invalid Compact Mode format. Expected comma-separated Types: Type1, Type2.',
                        severity: DiagnosticSeverity.Error,
                        source: 'agent-dsl',
                    });
                }
            }
        } else if (STRICT_BLOCKS.has(currentBlock)) {
            if (!/^([a-zA-Z0-9_.-]+)(\s+"[^"]*")?$/.test(stripped)) {
                const col = raw.indexOf(stripped);
                diagnostics.push({
                    range: { start: { line: i, character: col }, end: { line: i, character: col + stripped.length } },
                    message: `Invalid Documented Mode format in ${currentBlock}. Expected: Type or Type "Description".`,
                    severity: DiagnosticSeverity.Error,
                    source: 'agent-dsl',
                });
            } else if (declaredTypes.size > 0) {
                const typeName = stripped.match(/^([a-zA-Z0-9_.-]+)/)[1];
                if (!declaredTypes.has(typeName)) {
                    const col = raw.indexOf(typeName);
                    diagnostics.push({
                        range: { start: { line: i, character: col }, end: { line: i, character: col + typeName.length } },
                        message: `Type '${typeName}' is not declared in this file (assuming native or external).`,
                        severity: DiagnosticSeverity.Warning,
                        source: 'agent-dsl',
                    });
                }
            }
        }
    }
    return diagnostics;
}

function diagnoseFlow(text) {
    const diagnostics = [];
    const states = new Set(collectStates(text).map(s => s.name));

    // Rule 1: Dangling transitions
    const nextRe = /\bnext\s+([a-zA-Z0-9_.]+)/g;
    let m;
    while ((m = nextRe.exec(text)) !== null) {
        const target = m[1];
        if (!states.has(target)) {
            const external = target.includes('.');
            const start = offsetToPosition(text, m.index + m[0].indexOf(target));
            const end = offsetToPosition(text, m.index + m[0].length);
            diagnostics.push({
                range: { start, end },
                message: external
                    ? `State '${target}' is not defined locally (assuming external flow reference).`
                    : `State '${target}' is not defined in this file.`,
                severity: external ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
                source: 'flow-dsl',
            });
        }
    }

    // Rule 2: Dead-end interact (no next and no intent/escape handler)
    const blocks = text.split(/^state\s+/m);
    let offset = blocks[0].length;
    for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        if (block.includes('interact') && !/next\s+/.test(block) && !/on\s+(?:intent|escape)/.test(block)) {
            const idx = block.indexOf('interact');
            const pos = offsetToPosition(text, offset + idx);
            diagnostics.push({
                range: { start: pos, end: { line: pos.line, character: pos.character + 8 } },
                message: `This state calls interact but has no 'next' or 'on intent/escape'. This will trap the agent.`,
                severity: DiagnosticSeverity.Warning,
                source: 'flow-dsl',
            });
        }
        offset += block.length + 6; // 'state ' is 6 chars
    }

    return diagnostics;
}

function diagnose(langId, text) {
    if (langId === 'agent') return diagnoseAgent(text);
    if (langId === 'flow') return diagnoseFlow(text);
    return [];
}

module.exports = { diagnose };
