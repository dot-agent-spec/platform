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

import {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    TextDocumentSyncKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { init as bpInit, get_graph } from '@dot-agent/parser-dsl';
import { consolidate } from '@dot-agent/compiler';
import { fileURLToPath } from 'url';
import { dirname, relative } from 'node:path';

import { initParsers, parse, evict, nodesOfType } from './parser.js';
import { setWorkspaceRoots, findAgentRoot } from './merge-graph.js';

import { provideHover }           from './features/hover.js';
import { provideCompletions }     from './features/completions.js';
import { diagnose }               from './features/diagnostics.js';
import { provideDocumentSymbols } from './features/symbols.js';
import { provideDefinition }      from './features/definition.js';
import { provideReferences }      from './features/references.js';
import { provideRenameEdits }     from './features/rename.js';
import { format }                 from './features/formatting.js';
import { provideDocumentLinks }   from './features/links.js';

const connection = createConnection(ProposedFeatures.all);
const documents  = new TextDocuments(TextDocument);

// ── Initialization ───────────────────────────────────────────────────────────

// web-tree-sitter and behavior-parser are strictly async — await before
// advertising capabilities so no feature handler fires before parsers are ready.
connection.onInitialize(async (params) => {
    await initParsers();
    await bpInit();
    const roots = (params.workspaceFolders ?? [])
        .map(f => { try { return fileURLToPath(f.uri); } catch { return null; } })
        .filter(Boolean);
    if (roots.length === 0 && params.rootUri) {
        try { roots.push(fileURLToPath(params.rootUri)); } catch { /* non-file root, ignore */ }
    }
    setWorkspaceRoots(roots);
    return {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            hoverProvider: true,
            completionProvider: { triggerCharacters: ['.', ' '] },
            definitionProvider: true,
            referencesProvider: true,
            renameProvider: { prepareProvider: false },
            documentSymbolProvider: true,
            documentFormattingProvider: true,
            documentLinkProvider: { resolveProvider: false },
        },
    };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function getTree(doc) {
    return parse(doc.uri, doc.languageId, doc.getText(), doc.version);
}

// ── Diagnostics (push on change) ─────────────────────────────────────────────

async function validate(doc) {
    const langId = doc.languageId;
    if (langId !== 'description' && langId !== 'behavior') return;
    const diagnostics = await diagnose(doc.uri, langId, doc.getText());
    connection.sendDiagnostics({ uri: doc.uri, diagnostics });
}

documents.onDidChangeContent(e => validate(e.document));
documents.onDidOpen(e => validate(e.document));
documents.onDidClose(e => {
    evict(e.document.uri);
    connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] });
});

// ── Hover ────────────────────────────────────────────────────────────────────

connection.onHover(({ textDocument, position }) => {
    const doc = documents.get(textDocument.uri);
    if (!doc) return null;
    return provideHover(doc.languageId, doc.getText(), position);
});

// ── Completion ───────────────────────────────────────────────────────────────

connection.onCompletion(({ textDocument, position }) => {
    const doc = documents.get(textDocument.uri);
    if (!doc) return [];
    return provideCompletions(doc.languageId, getTree(doc), doc.getText(), position);
});

// ── Definition ───────────────────────────────────────────────────────────────

connection.onDefinition(({ textDocument, position }) => {
    const doc = documents.get(textDocument.uri);
    if (!doc) return null;
    return provideDefinition(doc.languageId, getTree(doc), doc.getText(), doc.uri, position);
});

// ── References ───────────────────────────────────────────────────────────────

connection.onReferences(({ textDocument, position }) => {
    const doc = documents.get(textDocument.uri);
    if (!doc) return [];
    return provideReferences(doc.languageId, getTree(doc), doc.getText(), doc.uri, position);
});

// ── Rename ───────────────────────────────────────────────────────────────────

connection.onRenameRequest(({ textDocument, position, newName }) => {
    const doc = documents.get(textDocument.uri);
    if (!doc) return null;
    return provideRenameEdits(doc.languageId, getTree(doc), doc.getText(), doc.uri, position, newName);
});

// ── Document Symbols ─────────────────────────────────────────────────────────

connection.onDocumentSymbol(({ textDocument }) => {
    try {
        const doc = documents.get(textDocument.uri);
        if (!doc) {
            connection.console.log('[symbols] doc not found for ' + textDocument.uri);
            return [];
        }
        const result = provideDocumentSymbols(doc.languageId, getTree(doc));
        connection.console.log(`[symbols] langId=${doc.languageId} count=${result.length} sample=${JSON.stringify(result[0]).slice(0,120)}`);
        return result;
    } catch (e) {
        connection.console.error('[symbols] threw: ' + e.message + '\n' + e.stack);
        return [];
    }
});

// ── Document Links ───────────────────────────────────────────────────────────

connection.onDocumentLinks(({ textDocument }) => {
    try {
        const doc = documents.get(textDocument.uri);
        if (!doc) return [];
        return provideDocumentLinks(doc.languageId, getTree(doc), doc.uri);
    } catch (e) {
        connection.console.error(`documentLinks error: ${e.message}`);
        return [];
    }
});

// ── Formatting ───────────────────────────────────────────────────────────────

connection.onDocumentFormatting(({ textDocument }) => {
    const doc = documents.get(textDocument.uri);
    if (!doc) return [];
    return format(doc.languageId, doc.getText());
});

// ── Behavior Graph (custom request) ──────────────────────────────────────────

connection.onRequest('agent/behaviorGraph', async ({ uri }) => {
    const doc = documents.get(uri);
    if (!doc || doc.languageId !== 'behavior') return null;
    const text = doc.getText();
    if (/^\s*merge\s+/m.test(text)) {
        try {
            let filePath;
            try { filePath = fileURLToPath(uri); } catch { filePath = uri; }
            const agentRoot = (await findAgentRoot(dirname(filePath))) ?? dirname(filePath);
            const { mergedText } = await consolidate(agentRoot, relative(agentRoot, filePath));
            return get_graph(mergedText);
        } catch { /* fallback to single-file graph */ }
    }
    return get_graph(text);
});

// ── Current State at Position (custom request) ────────────────────────────────

connection.onRequest('agent/currentState', ({ uri, position }) => {
    const doc = documents.get(uri);
    if (!doc || doc.languageId !== 'behavior') return null;
    const tree = getTree(doc);
    if (!tree) return null;
    const line = position.line;
    let result = null;
    for (const node of nodesOfType(tree, 'state_decl')) {
        if (node.startPosition.row > line) break;
        if (node.startPosition.row <= line && node.endPosition.row >= line) {
            result = node.childForFieldName('name')?.text ?? null;
        }
    }
    return result;
});

// ── Start ────────────────────────────────────────────────────────────────────

documents.listen(connection);
connection.listen();
