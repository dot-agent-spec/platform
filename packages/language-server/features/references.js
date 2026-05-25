'use strict';

const { escapeRegex, offsetToPosition } = require('../parser');

function provideReferences(langId, text, uri, position) {
    const lines = text.split('\n');
    const line = lines[position.line] || '';
    const ch = position.character;

    let start = ch, end = ch;
    while (start > 0 && /[a-zA-Z0-9_.]/.test(line[start - 1])) start--;
    while (end < line.length && /[a-zA-Z0-9_.]/.test(line[end])) end++;
    const word = line.slice(start, end);
    if (!word) return [];

    const patterns = langId === 'flow'
        ? [new RegExp(`^state\\s+(${escapeRegex(word)})\\b`, 'gm'), new RegExp(`\\bnext\\s+(${escapeRegex(word)})\\b`, 'g')]
        : [new RegExp(`^type\\s+(${escapeRegex(word)})\\b`, 'gm'), new RegExp(`^\\s+(${escapeRegex(word)})\\b`, 'gm')];

    const locations = [];
    for (const re of patterns) {
        let m;
        while ((m = re.exec(text)) !== null) {
            const idx = m.index + m[0].indexOf(m[1]);
            const pos = offsetToPosition(text, idx);
            locations.push({
                uri,
                range: { start: pos, end: { line: pos.line, character: pos.character + word.length } },
            });
        }
    }
    return locations;
}

module.exports = { provideReferences };
