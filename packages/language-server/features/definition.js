'use strict';

const { escapeRegex, offsetToPosition } = require('../parser');

function provideDefinition(langId, text, uri, position) {
    const lines = text.split('\n');
    const line = lines[position.line] || '';
    const ch = position.character;

    // Find word at cursor
    let start = ch, end = ch;
    while (start > 0 && /[a-zA-Z0-9_.]/.test(line[start - 1])) start--;
    while (end < line.length && /[a-zA-Z0-9_.]/.test(line[end])) end++;
    const word = line.slice(start, end);
    if (!word) return null;

    let pattern;
    if (langId === 'flow') {
        pattern = new RegExp(`^state\\s+${escapeRegex(word)}\\b`, 'm');
    } else if (langId === 'agent') {
        if (!/^[A-Z]/.test(word) && !word.includes('.')) return null;
        pattern = new RegExp(`^type\\s+${escapeRegex(word)}\\b`, 'm');
    } else {
        return null;
    }

    const m = pattern.exec(text);
    if (!m) return null;

    const pos = offsetToPosition(text, m.index);
    return {
        uri,
        range: { start: pos, end: { line: pos.line, character: lines[pos.line].length } },
    };
}

module.exports = { provideDefinition };
