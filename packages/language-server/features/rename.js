// SPDX-License-Identifier: Apache-2.0

import { nodesOfType, nodeToRange, wordAtPosition } from '../parser.js';

export function provideRenameEdits(langId, tree, text, uri, position, newName) {
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
    } else if (langId === 'description') {
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
