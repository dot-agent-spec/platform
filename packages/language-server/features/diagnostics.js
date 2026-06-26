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

import { lintBehavior, lintDescription } from '@dot-agent/compiler';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { fileURLToPath } from 'url';

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

export async function diagnose(uri, langId, text) {
    if (langId !== 'description' && langId !== 'behavior') return [];
    let filePath;
    try {
        filePath = fileURLToPath(uri);
    } catch {
        filePath = uri;
    }
    const msgs = langId === 'description'
        ? await lintDescription(text, filePath)
        : await lintBehavior(text, filePath, filePath);
    return msgs.map(toDiagnostic);
}
