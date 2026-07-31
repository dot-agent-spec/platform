// SPDX-License-Identifier: Apache-2.0

import { nodesOfType, nodeToRange } from '../parser.js';

// DocumentSymbol kind constants (LSP spec §3.17.5)
const Kind = { Class: 5, Struct: 23, Event: 24 };

export function provideDocumentSymbols(langId, tree) {
    if (!tree) return [];
    const symbols = [];

    if (langId === 'behavior') {
        for (const node of nodesOfType(tree, 'state_decl')) {
            const nameNode = node.childForFieldName('name');
            if (!nameNode) continue;
            symbols.push({
                name: nameNode.text,
                kind: Kind.Class,
                range: nodeToRange(node),
                selectionRange: nodeToRange(nameNode),
            });
        }
        for (const node of nodesOfType(tree, 'trigger_decl')) {
            const eventNode = node.childForFieldName('event');
            if (!eventNode) continue;
            const name = eventNode.text.replace(/^"|"$/g, '');
            symbols.push({
                name: `on event: ${name}`,
                kind: Kind.Event,
                range: nodeToRange(node),
                selectionRange: nodeToRange(eventNode),
            });
        }
    }

    if (langId === 'description') {
        for (const node of nodesOfType(tree, 'agent_decl')) {
            const nameNode = node.childForFieldName('name');
            if (!nameNode) continue;
            symbols.push({
                name: nameNode.text,
                kind: Kind.Class,
                range: nodeToRange(node),
                selectionRange: nodeToRange(nameNode),
            });
        }
        for (const node of nodesOfType(tree, 'type_decl')) {
            const nameNode = node.childForFieldName('name');
            if (!nameNode) continue;
            symbols.push({
                name: nameNode.text,
                kind: Kind.Struct,
                range: nodeToRange(node),
                selectionRange: nodeToRange(nameNode),
            });
        }
    }

    return symbols;
}
