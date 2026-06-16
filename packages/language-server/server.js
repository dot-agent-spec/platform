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

const {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    TextDocumentSyncKind,
    SymbolKind,
} = require('vscode-languageserver/node');
const { TextDocument } = require('vscode-languageserver-textdocument');

const { initParsers, parse, evict } = require('./parser');

const { provideHover }          = require('./features/hover');
const { provideCompletions }    = require('./features/completions');
const { diagnose }              = require('./features/diagnostics');
const { provideDocumentSymbols }= require('./features/symbols');
const { provideDefinition }     = require('./features/definition');
const { provideReferences }     = require('./features/references');
const { provideRenameEdits }    = require('./features/rename');
const { format }                = require('./features/formatting');
const { provideDocumentLinks }  = require('./features/links');

const connection = createConnection(ProposedFeatures.all);
const documents  = new TextDocuments(TextDocument);

// ── Initialization ───────────────────────────────────────────────────────────

// web-tree-sitter is strictly async — await before advertising capabilities
// so no feature handler fires before parsers are ready.
connection.onInitialize(async () => {
    await initParsers();
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

function validate(doc) {
    const langId = doc.languageId;
    if (langId !== 'description' && langId !== 'behavior') return;
    const tree = getTree(doc);
    const diagnostics = diagnose(langId, tree, doc.getText());
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

// ── Start ────────────────────────────────────────────────────────────────────

documents.listen(connection);
connection.listen();
