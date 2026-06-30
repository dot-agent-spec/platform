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

const BLOCK_HEADERS = /^(on\s+(intent|offtopic|failure|success)|if|else|after|parallel)\b/;
const TOP_LEVEL_LINE = /^(state|merge)\s|^on\s+event\b/;

function formatBehavior(text) {
    const edits = [];
    const lines = text.split('\n');
    let mode = 'PREAMBLE'; // PREAMBLE | STATE_BODY | NESTED_BODY

    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const trimmed = raw.trim();
        if (!trimmed) continue;

        let expectedIndent;
        if (TOP_LEVEL_LINE.test(trimmed)) {
            mode = /^state\s/.test(trimmed) ? 'STATE_BODY' : 'PREAMBLE';
            expectedIndent = 0;
        } else if (mode === 'PREAMBLE') {
            expectedIndent = 0;
        } else if (mode === 'STATE_BODY') {
            if (BLOCK_HEADERS.test(trimmed)) mode = 'NESTED_BODY';
            expectedIndent = 2;
        } else {
            if (/^end\b/.test(trimmed)) {
                mode = 'STATE_BODY';
                expectedIndent = 2;
            } else {
                expectedIndent = BLOCK_HEADERS.test(trimmed) ? 2 : 4;
            }
        }

        const actualIndent = raw.length - raw.trimStart().length;
        if (actualIndent !== expectedIndent) {
            edits.push({
                range: { start: { line: i, character: 0 }, end: { line: i, character: actualIndent } },
                newText: ' '.repeat(expectedIndent),
            });
        }
    }
    return edits;
}

function formatDescription(text) {
    const edits = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        if (!raw.trim()) continue;
        const expectedIndent = /^\s/.test(raw) ? 2 : 0;
        const actualIndent = raw.length - raw.trimStart().length;
        if (actualIndent !== expectedIndent) {
            edits.push({
                range: { start: { line: i, character: 0 }, end: { line: i, character: actualIndent } },
                newText: ' '.repeat(expectedIndent),
            });
        }
    }
    return edits;
}

export function format(langId, text) {
    if (langId === 'behavior') return formatBehavior(text);
    if (langId === 'description') return formatDescription(text);
    return [];
}
