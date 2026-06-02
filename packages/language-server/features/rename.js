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

function provideRenameEdits(langId, tree, text, uri, position, newName) {
    if (!tree) return null;

    const { word: oldName } = wordAtPosition(text, position.line, position.character);
    if (!oldName) return null;

    const edits = [];

    function addEdit(node) {
        edits.push({ range: nodeToRange(node), newText: newName });
    }

    if (langId === 'behavior') {
        // Rename state declarations
        for (const n of nodesOfType(tree, 'state_decl')) {
            const nameNode = n.childForFieldName('name');
            if (nameNode?.text === oldName) addEdit(nameNode);
        }
        // Rename transition targets
        for (const n of nodesOfType(tree, 'transition_stmt')) {
            const stateNode = n.childForFieldName('state');
            if (stateNode?.text === oldName) addEdit(stateNode);
        }
        // Rename inline intent handler targets
        for (const n of nodesOfType(tree, 'intent_trigger')) {
            const stateNode = n.childForFieldName('state');
            if (stateNode?.text === oldName) addEdit(stateNode);
        }
    } else if (langId === 'agent') {
        // Rename type declarations
        for (const n of nodesOfType(tree, 'type_decl')) {
            const nameNode = n.childForFieldName('name');
            if (nameNode?.text === oldName) addEdit(nameNode);
        }
        // Rename all type_ref usages
        for (const n of nodesOfType(tree, 'type_ref')) {
            const idNode = n.firstNamedChild;
            if (idNode?.text === oldName) addEdit(idNode);
        }
    }

    if (edits.length === 0) return null;
    return { changes: { [uri]: edits } };
}

module.exports = { provideRenameEdits };
