'use strict';

const BLOCK_HEADERS = /^(on\s+(intent|escape|fallback|complete|failed)|if|else|after|parallel)\b/;
const TOP_LEVEL_LINE = /^(state|merge)\s|^on\s+event\b/;

function formatFlow(text) {
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
            expectedIndent = BLOCK_HEADERS.test(trimmed) ? 2 : 4;
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

function formatAgent(text) {
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

function format(langId, text) {
    if (langId === 'flow') return formatFlow(text);
    if (langId === 'agent') return formatAgent(text);
    return [];
}

module.exports = { format };
