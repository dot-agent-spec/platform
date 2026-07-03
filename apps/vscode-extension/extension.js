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

function scxmlToMermaid(scxml) {
    if (!scxml || typeof scxml !== 'string') return 'stateDiagram-v2';
    const lines = ['stateDiagram-v2'];
    const connected = new Set();
    const transitionLines = [];
    const states = [];

    // Entry point: initial="X" attribute on <scxml>
    const initialM = /\binitial="([^"]+)"/.exec(scxml);
    if (initialM) {
        lines.push(`    [*] --> ${initialM[1]}`);
        connected.add(initialM[1]);
    }

    // State blocks and their transitions
    const stateBlockRe = /<state\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/state>/g;
    let m;
    while ((m = stateBlockRe.exec(scxml)) !== null) {
        const from = m[1];
        states.push(from);
        const transRe = /<transition\b([^>]*?)\/>/g;
        let tm;
        while ((tm = transRe.exec(m[2])) !== null) {
            const targetM = /\btarget="([^"]+)"/.exec(tm[1]);
            if (!targetM) continue;
            const to = targetM[1];
            connected.add(from);
            connected.add(to);
            const eventM = /\bevent="([^"]+)"/.exec(tm[1]);
            transitionLines.push(eventM
                ? `    ${from} --> ${to} : ${eventM[1]}`
                : `    ${from} --> ${to}`);
        }
    }

    lines.push(...transitionLines);

    // Isolated states (no incoming or outgoing connections)
    for (const s of states) {
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
<h2>Behavior Graph</h2>
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
    const serverModule = context.asAbsolutePath(path.join('dist', 'server.mjs'));
    client = new LanguageClient(
        'agentDsl',
        '.agent DSL Language Server',
        {
            run:   { module: serverModule, transport: TransportKind.stdio },
            debug: { module: serverModule, transport: TransportKind.stdio },
        },
        {
            documentSelector: [
                { scheme: 'file', language: 'description' },
                { scheme: 'file', language: 'behavior' },
            ],
        }
    );
    client.start();

    // ── Status Bar (VS Code-specific) ───────────────────────────────────────
    const statusBar = vscode.window.createStatusBarItem('dot-agent.behaviorState', vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBar);

    async function updateStatusBar(editor) {
        if (!editor || editor.document.languageId !== 'behavior') { statusBar.hide(); return; }
        try {
            const position = editor.selection.active;
            const stateName = await client.sendRequest('agent/currentState', {
                uri: editor.document.uri.toString(),
                position: { line: position.line, character: position.character },
            });
            if (stateName) {
                statusBar.text = `$(symbol-class) ${stateName}`;
                statusBar.tooltip = `Current behavior state: ${stateName}`;
                statusBar.show();
            } else {
                statusBar.hide();
            }
        } catch { statusBar.hide(); }
    }

    if (vscode.window.activeTextEditor) updateStatusBar(vscode.window.activeTextEditor);
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(updateStatusBar),
        vscode.window.onDidChangeTextEditorSelection(e => updateStatusBar(e.textEditor))
    );

    // ── Visual Graph Command (VS Code-specific) ─────────────────────────────
    let graphPanel = null;

    async function refreshGraph(uri) {
        if (!graphPanel) return;
        try {
            const graph = await client.sendRequest('agent/behaviorGraph', { uri });
            if (graph) graphPanel.webview.html = getGraphHtml(scxmlToMermaid(graph));
        } catch { /* servidor ainda não pronto ou arquivo inválido */ }
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
            refreshGraph(editor.document.uri.toString());
        }),
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (doc.languageId === 'behavior') refreshGraph(doc.uri.toString());
        })
    );
}

function deactivate() {
    if (client) return client.stop();
}

module.exports = { activate, deactivate };
