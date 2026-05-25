'use strict';

const { fileURLToPath, pathToFileURL } = require('url');
const path = require('path');

const PATTERNS = {
    agent: [
        // behavior mickey.flow
        { re: /^behavior\s+("?)([^\s"]+)\1/, fileGroup: 2 },
        // schema doctor.schema.json
        { re: /^\s+schema\s+("?)([^\s"]+)\1/, fileGroup: 2 },
    ],
    flow: [
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

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];

        for (const { re, fileGroup } of patterns) {
            const m = re.exec(line);
            if (!m) continue;

            const filename = m[fileGroup];
            if (!filename) continue;

            // lastIndexOf is safe even when the filename is a substring of the keyword
            // (e.g. `behavior behavior.flow`) because the filename always appears last.
            const colStart = m.index + m[0].lastIndexOf(filename);
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
    }

    return links;
}

module.exports = { provideDocumentLinks };
