'use strict';

const { SymbolKind } = require('vscode-languageserver');
const { collectStates, collectTypes, offsetToPosition } = require('../parser');

function provideDocumentSymbols(langId, text) {
    const symbols = [];
    const lines = text.split('\n');

    if (langId === 'flow') {
        const stateRe = /^state\s+([a-zA-Z_][a-zA-Z0-9_.\-]*)/gm;
        const eventRe = /^on\s+event\s+"([^"]+)"/gm;
        let m;
        while ((m = stateRe.exec(text)) !== null) {
            const pos = offsetToPosition(text, m.index);
            symbols.push({
                name: m[1],
                kind: SymbolKind.Class,
                location: { uri: '', range: { start: pos, end: { line: pos.line, character: lines[pos.line].length } } },
            });
        }
        while ((m = eventRe.exec(text)) !== null) {
            const pos = offsetToPosition(text, m.index);
            symbols.push({
                name: `on event: ${m[1]}`,
                kind: SymbolKind.Event,
                location: { uri: '', range: { start: pos, end: { line: pos.line, character: lines[pos.line].length } } },
            });
        }
    }

    if (langId === 'agent') {
        const agentRe = /^agent\s+(.+)/gm;
        const typeRe  = /^type\s+([a-zA-Z0-9_.-]+)/gm;
        let m;
        while ((m = agentRe.exec(text)) !== null) {
            const pos = offsetToPosition(text, m.index);
            symbols.push({
                name: m[1].trim(),
                kind: SymbolKind.Class,
                location: { uri: '', range: { start: pos, end: { line: pos.line, character: lines[pos.line].length } } },
            });
        }
        while ((m = typeRe.exec(text)) !== null) {
            const pos = offsetToPosition(text, m.index);
            symbols.push({
                name: m[1],
                kind: SymbolKind.Struct,
                location: { uri: '', range: { start: pos, end: { line: pos.line, character: lines[pos.line].length } } },
            });
        }
    }

    return symbols;
}

module.exports = { provideDocumentSymbols };
