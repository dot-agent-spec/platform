// SPDX-License-Identifier: Apache-2.0

import { nodesOfType, nodeToRange, wordAtPosition } from '../parser.js';

export function provideReferences(langId, tree, text, uri, position) {
    if (!tree) return [];

    const { word } = wordAtPosition(text, position.line, position.character);
    if (!word) return [];

    const locations = [];

    function add(node) {
        locations.push({ uri, range: nodeToRange(node) });
    }

    if (langId === 'behavior') {
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
    } else if (langId === 'description') {
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
