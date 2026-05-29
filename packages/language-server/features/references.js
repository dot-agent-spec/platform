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
