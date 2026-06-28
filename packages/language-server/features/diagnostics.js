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

import { lintBehavior, lintDescription, consolidate } from '@dot-agent/compiler';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { fileURLToPath } from 'url';
import { dirname, basename } from 'node:path';

function toDiagnostic(msg) {
    const severity =
        msg.severity === 'error'   ? DiagnosticSeverity.Error :
        msg.severity === 'warning' ? DiagnosticSeverity.Warning :
        msg.severity === 'info'    ? DiagnosticSeverity.Information :
                                     DiagnosticSeverity.Hint;
    const text = msg.hint
        ? `[${msg.code}] ${msg.message} (${msg.hint})`
        : `[${msg.code}] ${msg.message}`;
    return {
        range: {
            start: { line: msg.line - 1, character: msg.col - 1 },
            end:   { line: msg.line - 1, character: msg.col - 1 },
        },
        message: text,
        severity,
        source: 'dot-agent',
    };
}

function hasMerge(text) {
    return /^\s*merge\s+/m.test(text);
}

export async function diagnose(uri, langId, text) {
    if (langId !== 'description' && langId !== 'behavior') return [];
    let filePath;
    try {
        filePath = fileURLToPath(uri);
    } catch {
        filePath = uri;
    }

    if (langId === 'description') {
        const msgs = await lintDescription(text, filePath);
        return msgs.map(toDiagnostic);
    }

    // behavior: run consolidated lint when the file uses merge declarations
    if (!hasMerge(text)) {
        const msgs = await lintBehavior(text, filePath, filePath, true);
        return msgs.map(toDiagnostic);
    }

    // multi-file behavior: attempt consolidation to surface E012/E013/E014/E015/E016
    const consolidationDiags = [];
    let behaviorText = text;
    let isConsolidated = false;
    try {
        const { mergedText } = await consolidate(dirname(filePath), basename(filePath));
        behaviorText = mergedText;
        isConsolidated = true;
    } catch (err) {
        const m = /^(E\d+):\s*(.+)/.exec(err.message);
        if (m) {
            consolidationDiags.push({
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
                message: `[${m[1]}] ${m[2]}`,
                severity: DiagnosticSeverity.Error,
                source: 'dot-agent',
            });
        }
    }

    const msgs = await lintBehavior(behaviorText, filePath, filePath, isConsolidated);
    return [...consolidationDiags, ...msgs.map(toDiagnostic)];
}
