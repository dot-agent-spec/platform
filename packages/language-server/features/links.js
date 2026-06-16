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

const { fileURLToPath, pathToFileURL } = require('url');
const path = require('path');
const { nodesOfType, nodeToRange } = require('../parser');

function provideDocumentLinks(langId, tree, docUri) {
    if (!tree) return [];

    let docDir;
    try {
        docDir = path.dirname(fileURLToPath(docUri));
    } catch {
        return [];
    }

    const links = [];

    function addLink(fileNode, rawText) {
        const filename = rawText.replace(/^"|"$/g, '');   // strip optional quotes
        if (!filename) return;
        links.push({
            range: nodeToRange(fileNode),
            target: pathToFileURL(path.resolve(docDir, filename)).toString(),
        });
    }

    if (langId === 'description') {
        for (const node of nodesOfType(tree, 'behavior_block')) {
            const fileNode = node.childForFieldName('file');
            if (fileNode) addLink(fileNode, fileNode.text);
        }
    }

    if (langId === 'behavior') {
        for (const node of nodesOfType(tree, 'merge_decl')) {
            const pathNode = node.childForFieldName('path');
            if (pathNode) addLink(pathNode, pathNode.text);
        }
        for (const node of nodesOfType(tree, 'run_stmt')) {
            const runTypeNode = node.childForFieldName('type');
            if (runTypeNode?.text !== 'script') continue;
            const targetNode = node.childForFieldName('target');
            if (targetNode) addLink(targetNode, targetNode.text);
        }
    }

    return links;
}

module.exports = { provideDocumentLinks };
