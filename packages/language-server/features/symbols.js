'use strict';

// DocumentSymbol kind constants (LSP spec §3.17.5)
const Kind = { Class: 5, Struct: 23, Event: 24 };

function provideDocumentSymbols(langId, text) {
    const symbols = [];
    const lines = text.split('\n');

    function range(offset) {
        const before = text.slice(0, offset);
        const linesBefore = before.split('\n');
        const line = linesBefore.length - 1;
        const start = { line, character: linesBefore[line].length };
        const end   = { line, character: lines[line].length };
        return { start, end };
    }

    if (langId === 'flow') {
        const stateRe = /^state\s+([a-zA-Z_][a-zA-Z0-9_.\-]*)/gm;
        const eventRe = /^on\s+event\s+"([^"]+)"/gm;
        let m;
        while ((m = stateRe.exec(text)) !== null) {
            const r = range(m.index);
            symbols.push({ name: m[1], kind: Kind.Class,  range: r, selectionRange: r });
        }
        while ((m = eventRe.exec(text)) !== null) {
            const r = range(m.index);
            symbols.push({ name: `on event: ${m[1]}`, kind: Kind.Event, range: r, selectionRange: r });
        }
    }

    if (langId === 'agent') {
        const agentRe = /^agent\s+(.+)/gm;
        const typeRe  = /^type\s+([a-zA-Z0-9_.-]+)/gm;
        let m;
        while ((m = agentRe.exec(text)) !== null) {
            const r = range(m.index);
            symbols.push({ name: m[1].trim(), kind: Kind.Class,  range: r, selectionRange: r });
        }
        while ((m = typeRe.exec(text)) !== null) {
            const r = range(m.index);
            symbols.push({ name: m[1],        kind: Kind.Struct, range: r, selectionRange: r });
        }
    }

    return symbols;
}

module.exports = { provideDocumentSymbols };
