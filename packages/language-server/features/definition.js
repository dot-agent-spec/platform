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

const fs = require('fs');
const { fileURLToPath, pathToFileURL } = require('url');
const path = require('path');
const { nodesOfType, nodeToRange, wordAtPosition, parseText } = require('../parser');

// Busca recursiva de state_decl em arquivos mergeados.
// visited (Set<absPath>) evita loops em grafos de merge circulares.
function findStateInMerges(tree, docDir, word, visited = new Set()) {
    for (const mergeNode of nodesOfType(tree, 'merge_decl')) {
        const pathNode = mergeNode.childForFieldName('path');
        if (!pathNode) continue;
        const filename = pathNode.text.replace(/^"|"$/g, '');
        const absPath = path.resolve(docDir, filename);
        if (visited.has(absPath)) continue;
        visited.add(absPath);
        let mergedText;
        try { mergedText = fs.readFileSync(absPath, 'utf8'); } catch { continue; }
        const mergedTree = parseText('behavior', mergedText);
        if (!mergedTree) continue;
        const found = nodesOfType(mergedTree, 'state_decl')
            .find(n => n.childForFieldName('name')?.text === word);
        if (found) return { uri: pathToFileURL(absPath).toString(), range: nodeToRange(found) };
        const sub = findStateInMerges(mergedTree, path.dirname(absPath), word, visited);
        if (sub) return sub;
    }
    return null;
}

function provideDefinition(langId, tree, text, uri, position) {
    if (!tree) return null;

    const { word } = wordAtPosition(text, position.line, position.character);
    if (!word) return null;

    if (langId === 'behavior') {
        const local = nodesOfType(tree, 'state_decl')
            .find(n => n.childForFieldName('name')?.text === word);
        if (local) return { uri, range: nodeToRange(local) };
        try {
            const docDir = path.dirname(fileURLToPath(uri));
            return findStateInMerges(tree, docDir, word) ?? null;
        } catch { return null; }
    }

    if (langId === 'description') {
        if (!/^[A-Z]/.test(word) && !word.includes('.')) return null;
        const targetNode = nodesOfType(tree, 'type_decl')
            .find(n => n.childForFieldName('name')?.text === word);
        if (!targetNode) return null;
        return { uri, range: nodeToRange(targetNode) };
    }

    return null;
}

module.exports = { provideDefinition };
