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
