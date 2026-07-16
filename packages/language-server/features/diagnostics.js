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

import { lintBehavior, lintDescription, consolidate, parseBehaviorFile } from '@dot-agent/compiler';
import { DiagnosticSeverity } from 'vscode-languageserver';
import { fileURLToPath } from 'url';
import { dirname, relative } from 'node:path';
import { findMergeRoot, findAgentRoot } from '../merge-graph.js';

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

    // Agent root = nearest ancestor directory (bounded by the client's
    // workspace folder) with a *.description file — same convention pack.ts
    // uses to define an agent bundle. Falls back to the file's own directory
    // when no manifest is found, e.g. a lone .behavior file opened outside
    // an agent.
    const foundRoot = await findAgentRoot(dirname(filePath));
    const agentRoot = foundRoot ?? dirname(filePath);
    const entryFile = relative(agentRoot, filePath);

    // behavior: run consolidated lint when the file uses merge declarations
    if (!hasMerge(text)) {
        // This file has no merge of its own, but it might be a fragment that
        // another file merges in (e.g. a shared sub-flow). Walk merge edges
        // backward within the agent root to find that root and borrow its
        // consolidated state set, so cross-file transitions don't show as
        // dangling (E005) and this fragment isn't wrongly held to whole-tree
        // rules like E016 (init required) that only make sense at the root.
        //
        // Only do this when we actually found an agent bundle (a *.description
        // marker). Without one, `agentRoot` is just the file's own directory,
        // and findMergeRoot's backward scan (collectBehaviorFiles) would crawl
        // it recursively — for a lone file opened at `/` or under the home dir
        // that means a huge filesystem walk that trips macOS TCC prompts and
        // times out. A file outside any bundle has no merge graph anyway, so
        // local-only lint below is the correct answer.
        const root = foundRoot ? await findMergeRoot(agentRoot, entryFile) : null;
        if (root) {
            try {
                const { mergedText } = await consolidate(agentRoot, root);
                const externalStates = new Set((parseBehaviorFile(mergedText).ok?.states ?? []).map(s => s.name));
                const msgs = await lintBehavior(text, filePath, filePath, false, externalStates, mergedText);
                return msgs.map(toDiagnostic);
            } catch {
                // root's own merge chain is broken — fall back to local-only lint below
            }
        }
        const msgs = await lintBehavior(text, filePath, filePath, true);
        return msgs.map(toDiagnostic);
    }

    // multi-file behavior: attempt consolidation to surface E012/E013/E014/E015/E016.
    // Local diagnostics still run against this file's own `text` — never the
    // merged blob — so positions stay correct; `mergedText` is only consulted
    // for whole-tree facts (E015/E016/W014) and W001/W009 reachability.
    const consolidationDiags = [];
    let mergedText;
    let isConsolidated = false;
    try {
        ({ mergedText } = await consolidate(agentRoot, entryFile));
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

    const msgs = await lintBehavior(text, filePath, filePath, isConsolidated, undefined, mergedText);
    return [...consolidationDiags, ...msgs.map(toDiagnostic)];
}
