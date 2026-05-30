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

function provideReferences(langId, tree, text, uri, position) {
    if (!tree) return [];

    const { word } = wordAtPosition(text, position.line, position.character);
    if (!word) return [];

    const locations = [];

    function add(node) {
        locations.push({ uri, range: nodeToRange(node) });
    }

    if (langId === 'flow') {
        // Declaration
        for (const n of nodesOfType(tree, 'state_decl')) {
            const nameNode = n.childForFieldName('name');
            if (nameNode?.text === word) add(nameNode);
        }
        // Direct transitions: next <state>
        for (const n of nodesOfType(tree, 'transition_stmt')) {
            const stateNode = n.childForFieldName('state');
            if (stateNode?.text === word) add(stateNode);
        }
        // Inline intent handlers: on intent "..." next <state>
        for (const n of nodesOfType(tree, 'intent_trigger')) {
            const stateNode = n.childForFieldName('state');
            if (stateNode?.text === word) add(stateNode);
        }
    } else if (langId === 'agent') {
        // Declaration
        for (const n of nodesOfType(tree, 'type_decl')) {
            const nameNode = n.childForFieldName('name');
            if (nameNode?.text === word) add(nameNode);
        }
        // All type_ref usages (input/output/requires/capabilities blocks and property types)
        for (const n of nodesOfType(tree, 'type_ref')) {
            const idNode = n.firstNamedChild;
            if (idNode?.text === word) add(idNode);
        }
    }

    return locations;
}

module.exports = { provideReferences };
