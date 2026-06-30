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

import { fileURLToPath, pathToFileURL } from 'url';
import { resolve, dirname } from 'path';
import { nodesOfType, nodeToRange } from '../parser.js';

// Detecta se um nó bare_string representa um caminho de arquivo.
// Usa o subtipo do tree-sitter (filename) como primeira fonte de verdade;
// cai no regex do grammar.js como fallback para ambientes que não expõem subnós.
// O padrão aceita: extensão simples (a.md), dupla (a.b.persona), longa (.behavior)
// e exclui texto livre (que tem espaços/pontuação fora do charset).
function isFilename(node) {
    if (node.firstNamedChild?.type === 'filename') return true;
    return /^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+$/.test(node.text.replace(/^"|"$/g, ''));
}

export function provideDocumentLinks(langId, tree, docUri) {
    if (!tree) return [];

    let docDir;
    try {
        docDir = dirname(fileURLToPath(docUri));
    } catch {
        return [];
    }

    const links = [];

    function addFileLink(fileNode, rawText) {
        const filename = rawText.replace(/^"|"$/g, '');
        if (!filename) return;
        links.push({
            range: nodeToRange(fileNode),
            target: pathToFileURL(resolve(docDir, filename)).toString(),
        });
    }

    function addUrlLink(uriNode) {
        const url = uriNode.text.trim();
        if (!url) return;
        links.push({ range: nodeToRange(uriNode), target: url });
    }

    if (langId === 'description') {
        for (const node of nodesOfType(tree, 'behavior_block')) {
            const fileNode = node.childForFieldName('file');
            if (fileNode) addFileLink(fileNode, fileNode.text);
        }
        for (const node of nodesOfType(tree, 'persona_block')) {
            const fileNode = node.childForFieldName('file');
            if (fileNode && isFilename(fileNode)) addFileLink(fileNode, fileNode.text);
        }
        for (const node of nodesOfType(tree, 'category_prop')) {
            const uriNode = node.childForFieldName('uri');
            if (uriNode) addUrlLink(uriNode);
        }
        for (const node of nodesOfType(tree, 'concept_prop')) {
            const uriNode = node.childForFieldName('uri');
            if (uriNode) addUrlLink(uriNode);
        }
    }

    if (langId === 'behavior') {
        for (const node of nodesOfType(tree, 'merge_decl')) {
            const pathNode = node.childForFieldName('path');
            if (pathNode) addFileLink(pathNode, pathNode.text);
        }
        for (const node of nodesOfType(tree, 'run_stmt')) {
            const runTypeNode = node.childForFieldName('type');
            if (runTypeNode?.text !== 'script') continue;
            const targetNode = node.childForFieldName('target');
            if (targetNode) addFileLink(targetNode, targetNode.text);
        }
    }

    return links;
}
