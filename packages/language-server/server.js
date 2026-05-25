'use strict';

const {
    createConnection,
    TextDocuments,
    ProposedFeatures,
    TextDocumentSyncKind,
    SymbolKind,
} = require('vscode-languageserver/node');
const { TextDocument } = require('vscode-languageserver-textdocument');

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

connection.onInitialize(() => ({
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
}));

// ── Diagnostics (push on change) ─────────────────────────────────────────────

function validate(doc) {
    const langId = doc.languageId;
    if (langId !== 'agent' && langId !== 'flow') return;
    const diagnostics = diagnose(langId, doc.getText());
    connection.sendDiagnostics({ uri: doc.uri, diagnostics });
}

documents.onDidChangeContent(e => validate(e.document));
documents.onDidOpen(e => validate(e.document));
documents.onDidClose(e => connection.sendDiagnostics({ uri: e.document.uri, diagnostics: [] }));

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
    return provideCompletions(doc.languageId, doc.getText(), position);
});

// ── Definition ───────────────────────────────────────────────────────────────

connection.onDefinition(({ textDocument, position }) => {
    const doc = documents.get(textDocument.uri);
    if (!doc) return null;
    return provideDefinition(doc.languageId, doc.getText(), doc.uri, position);
});

// ── References ───────────────────────────────────────────────────────────────

connection.onReferences(({ textDocument, position }) => {
    const doc = documents.get(textDocument.uri);
    if (!doc) return [];
    return provideReferences(doc.languageId, doc.getText(), doc.uri, position);
});

// ── Rename ───────────────────────────────────────────────────────────────────

connection.onRenameRequest(({ textDocument, position, newName }) => {
    const doc = documents.get(textDocument.uri);
    if (!doc) return null;
    return provideRenameEdits(doc.languageId, doc.getText(), doc.uri, position, newName);
});

// ── Document Symbols ─────────────────────────────────────────────────────────

connection.onDocumentSymbol(({ textDocument }) => {
    const doc = documents.get(textDocument.uri);
    if (!doc) return [];
    // Fix up the uri in each location before returning
    return provideDocumentSymbols(doc.languageId, doc.getText()).map(sym => ({
        ...sym,
        location: { ...sym.location, uri: doc.uri },
    }));
});

// ── Document Links ───────────────────────────────────────────────────────────

connection.onDocumentLinks(({ textDocument }) => {
    const doc = documents.get(textDocument.uri);
    if (!doc) return [];
    return provideDocumentLinks(doc.languageId, doc.getText(), doc.uri);
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
