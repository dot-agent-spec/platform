'use strict';

const { escapeRegex, offsetToPosition } = require('../parser');

function provideRenameEdits(langId, text, uri, position, newName) {
    const lines = text.split('\n');
    const line = lines[position.line] || '';
    const ch = position.character;

    let start = ch, end = ch;
    while (start > 0 && /[a-zA-Z0-9_.]/.test(line[start - 1])) start--;
    while (end < line.length && /[a-zA-Z0-9_.]/.test(line[end])) end++;
    const oldName = line.slice(start, end);
    if (!oldName) return null;

    const lineText = lines[position.line] || '';
    if (langId === 'flow') {
        if (!/^state\s+/.test(lineText) && !/\bnext\s+/.test(lineText)) return null;
    } else if (langId === 'agent') {
        if (!/^type\s+/.test(lineText) && !/^\s/.test(lineText)) return null;
    }

    const esc = escapeRegex(oldName);
    const patterns = langId === 'flow'
        ? [new RegExp(`(^state\\s+)(${esc})\\b`, 'gm'), new RegExp(`(\\bnext\\s+)(${esc})\\b`, 'g')]
        : [new RegExp(`(^type\\s+)(${esc})\\b`, 'gm'), new RegExp(`(^\\s+)(${esc})\\b`, 'gm')];

    const edits = [];
    for (const re of patterns) {
        let m;
        while ((m = re.exec(text)) !== null) {
            const s = offsetToPosition(text, m.index + m[1].length);
            edits.push({
                range: { start: s, end: { line: s.line, character: s.character + oldName.length } },
                newText: newName,
            });
        }
    }

    if (edits.length === 0) return null;
    return { changes: { [uri]: edits } };
}

module.exports = { provideRenameEdits };
