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

const vscode = require('vscode');
const path = require('path');
const { LanguageClient, TransportKind } = require('vscode-languageclient/node');

// ─── Graph helpers ────────────────────────────────────────────────────────────

function parseBehaviorForGraph(text) {
    const states = [];
    const transitions = [];
    const entryPoints = [];

    const stateRe = /^state\s+([a-zA-Z_][a-zA-Z0-9_.\-]*)/gm;
    let m;
    while ((m = stateRe.exec(text)) !== null) states.push(m[1]);

    const segments = text.split(/(?=^(?:state|on\s+event)\s)/m);
    for (const seg of segments) {
        const stateM = seg.match(/^state\s+([a-zA-Z_][a-zA-Z0-9_.\-]*)/);
        const eventM = seg.match(/^on\s+event\s+"([^"]+)"/);
        if (stateM) {
            const from = stateM[1];
            const nextRe = /\btransition\s+to\s+([a-zA-Z_][a-zA-Z0-9_.\-]*)/g;
            let n;
            while ((n = nextRe.exec(seg)) !== null) {
                if (!transitions.find(t => t.from === from && t.to === n[1])) {
                    transitions.push({ from, to: n[1] });
                }
            }
        } else if (eventM) {
            const n = seg.match(/\bnext\s+([a-zA-Z_][a-zA-Z0-9_.\-]*)/);
            if (n) entryPoints.push({ event: eventM[1], to: n[1] });
        }
    }

    return { states, transitions, entryPoints };
}

function generateMermaid(parsed) {
    const lines = ['stateDiagram-v2'];
    for (const ep of parsed.entryPoints) {
        lines.push(`    [*] --> ${ep.to} : ${ep.event}`);
    }
    for (const t of parsed.transitions) {
        lines.push(`    ${t.from} --> ${t.to}`);
    }
    const connected = new Set([
        ...parsed.entryPoints.map(e => e.to),
        ...parsed.transitions.flatMap(t => [t.from, t.to]),
    ]);
    for (const s of parsed.states) {
        if (!connected.has(s)) lines.push(`    ${s}`);
    }
    return lines.join('\n');
}

function getGraphHtml(mermaidDiagram) {
    const csp = "default-src 'none'; script-src https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'unsafe-inline';";
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<style>
body { background:#1e1e1e; color:#d4d4d4; font-family:sans-serif; padding:24px; margin:0; }
h2 { font-size:13px; font-weight:500; color:#a855f7; margin:0 0 16px; letter-spacing:.05em; text-transform:uppercase; }
.mermaid { background:#252526; border-radius:8px; padding:24px; }
</style>
</head>
<body>
<h2>Flow Graph</h2>
<pre class="mermaid">${mermaidDiagram}</pre>
<script type="module">
import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
mermaid.initialize({ startOnLoad: true, theme: 'dark' });
</script>
</body>
</html>`;
}

// ─── activate ─────────────────────────────────────────────────────────────────

let client;

function activate(context) {
    // ── Language Client (LSP) ───────────────────────────────────────────────
    const serverModule = context.asAbsolutePath(path.join('node_modules', '@dot-agent', 'language-server', 'server.js'));
    client = new LanguageClient(
        'agentDsl',
        'Agent & Flow DSL Language Server',
        {
            run:   { module: serverModule, transport: TransportKind.stdio },
            debug: { module: serverModule, transport: TransportKind.stdio },
        },
        {
            documentSelector: [
                { scheme: 'file', language: 'agent' },
                { scheme: 'file', language: 'behavior' },
            ],
        }
    );
    client.start();

    // ── Status Bar (VS Code-specific) ───────────────────────────────────────
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBar);

    function updateStatusBar(editor) {
        if (!editor || editor.document.languageId !== 'behavior') { statusBar.hide(); return; }
        const text = editor.document.getText();
        const offset = editor.document.offsetAt(editor.selection.active);
        const before = text.slice(0, offset);
        const lines = before.split('\n').reverse();
        let stateName = null;
        for (const line of lines) {
            const mm = line.match(/^state\s+([a-zA-Z_][a-zA-Z0-9_.\-]*)/);
            if (mm) { stateName = mm[1]; break; }
        }
        if (stateName) {
            statusBar.text = `$(symbol-class) ${stateName}`;
            statusBar.tooltip = `Current behavior state: ${stateName}`;
            statusBar.show();
        } else {
            statusBar.hide();
        }
    }

    if (vscode.window.activeTextEditor) updateStatusBar(vscode.window.activeTextEditor);
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(updateStatusBar),
        vscode.window.onDidChangeTextEditorSelection(e => updateStatusBar(e.textEditor))
    );

    // ── Visual Graph Command (VS Code-specific) ─────────────────────────────
    let graphPanel = null;

    function refreshGraph(text) {
        if (graphPanel) graphPanel.webview.html = getGraphHtml(generateMermaid(parseBehaviorForGraph(text)));
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('behavior.openGraph', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'behavior') {
                vscode.window.showWarningMessage('Open a .behavior file to view its graph.');
                return;
            }
            if (graphPanel) {
                graphPanel.reveal(vscode.ViewColumn.Beside);
            } else {
                graphPanel = vscode.window.createWebviewPanel('behaviorGraph', 'Behavior Graph', vscode.ViewColumn.Beside, { enableScripts: true });
                graphPanel.onDidDispose(() => { graphPanel = null; }, null, context.subscriptions);
            }
            refreshGraph(editor.document.getText());
        }),
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (doc.languageId === 'behavior') refreshGraph(doc.getText());
        })
    );
}

function deactivate() {
    if (client) return client.stop();
}

module.exports = { activate, deactivate };
