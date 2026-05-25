'use strict';

const { fileURLToPath, pathToFileURL } = require('url');
const path = require('path');

// Patterns that reference external files, per language.
// Each entry: { re, fileGroup } where re is applied per line and fileGroup
// is the capture group index that holds the bare filename.
const PATTERNS = {
    agent: [
        // behavior mickey.flow
        { re: /^behavior\s+("?)([^\s"]+)\1/, fileGroup: 2 },
        // schema doctor.schema.json
        { re: /^\s+schema\s+("?)([^\s"]+)\1/, fileGroup: 2 },
    ],
    flow: [
        // run agent.some-file  (if the spec ever adds it)
        { re: /^(?:run|load)\s+("?)([^\s"]+)\1/, fileGroup: 2 },
    ],
};

function provideDocumentLinks(langId, text, docUri) {
    const patterns = PATTERNS[langId];
    if (!patterns) return [];

    let docDir;
    try {
        docDir = path.dirname(fileURLToPath(docUri));
    } catch {
        return [];
    }

    const links = [];
    const lines = text.split('\n');
    let offset = 0;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];

        for (const { re, fileGroup } of patterns) {
            const m = re.exec(line);
            if (!m) continue;

            const filename = m[fileGroup];
            if (!filename) continue;

            // Column range of the filename inside the line
            const colStart = m.index + m[0].indexOf(filename);
            const colEnd   = colStart + filename.length;

            const targetPath = path.resolve(docDir, filename);
            const targetUri  = pathToFileURL(targetPath).toString();

            links.push({
                range: {
                    start: { line: lineIdx, character: colStart },
                    end:   { line: lineIdx, character: colEnd },
                },
                target: targetUri,
            });
        }

        offset += line.length + 1; // +1 for '\n'
    }

    return links;
}

module.exports = { provideDocumentLinks };
