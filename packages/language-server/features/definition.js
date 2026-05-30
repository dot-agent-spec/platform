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

const { nodesOfType, nodeToRange, wordAtPosition } = require('../parser');

function provideDefinition(langId, tree, text, uri, position) {
    if (!tree) return null;

    const { word } = wordAtPosition(text, position.line, position.character);
    if (!word) return null;

    let targetNode = null;

    if (langId === 'flow') {
        targetNode = nodesOfType(tree, 'state_decl')
            .find(n => n.childForFieldName('name')?.text === word);
    } else if (langId === 'agent') {
        if (!/^[A-Z]/.test(word) && !word.includes('.')) return null;
        targetNode = nodesOfType(tree, 'type_decl')
            .find(n => n.childForFieldName('name')?.text === word);
    }

    if (!targetNode) return null;
    return { uri, range: nodeToRange(targetNode) };
}

module.exports = { provideDefinition };
