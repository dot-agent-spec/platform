const vscode = require('vscode');
const path = require('path');

// ─── Hover docs ───────────────────────────────────────────────────────────────

const flowHoverDocs = {
    'merge':       '**`merge "file.flow"`**\n\nIncludes another `.flow` file. Must appear before any `state` or `on event` declarations (preamble-only, eager loading).',
    'state':       '**`state name`**\n\nDeclares a named state. States contain the logic that runs while the agent is in that state.',
    'on':          '**`on event|intent|escape|fallback|complete|failed`**\n\nBinds a handler to a trigger. Top-level: `on event`. Inside a state: `on intent`, `on escape`, `on fallback`. After parallel: `on complete`, `on failed`.',
    'run':         '**`run script|subagent|tool "target"`**\n\nExecutes a script, subagent, or tool. Accepts optional modifiers: `silent`, `in background`, `each collection`.',
    'guide':       '**`guide "text"`**\n\nInjects a system-level instruction into the conversation context, shaping the agent\'s persona or approach without being visible as a reply.',
    'teach':       '**`teach "text"`**\n\nAdds a fact or constraint to the agent\'s working knowledge for the duration of this state.',
    'goal':        '**`goal "text"`**\n\nSets the agent\'s objective for this state, used by the runtime for planning and alignment checks.',
    'interact':    '**`interact [requiring "text"]`**\n\nPauses execution and waits for user input. Optionally enforces a requirement before continuing.',
    'set':         '**`set domain.var = value`**\n\nAssigns a value to a memory variable. Domains: `context`, `session`, `worksession`, `user`.',
    'context':     '**`context`** memory domain — scoped to the current agent run.',
    'session':     '**`session`** memory domain — persists for the user\'s current session.',
    'worksession': '**`worksession`** memory domain — persists across a task-oriented work session (isolated per task).',
    'user':        '**`user`** memory domain — persists across sessions for a given user.',
    'next':        '**`next state`**\n\nTransitions immediately to the named state.',
    'if':          '**`if condition`**\n\nConditional execution. Condition can use `==`, `!=`, `>`, `<`, `>=`, `<=`, `and`, `or`.',
    'else':        '**`else`**\n\nAlternative branch of an `if` statement.',
    'after':       '**`after N prompts`**\n\n[Experimental] Executes a block after N user prompts have occurred in this state.',
    'parallel':    '**`parallel`**\n\n[Experimental] Runs a block of `run` statements concurrently. Follow with `on complete` and `on failed` handlers.',
    'apply':       '**`apply css|html|video "text"`**\n\nApplies a UI manipulation to a CSS selector, HTML element, or video element.',
    'remove':      '**`remove css|html|video "text"`**\n\nRemoves a UI element by selector or reference.',
};

const hoverDocs = {
    'agent':        '**`agent name`**\n\nDeclares a new agent. The central node of the manifest.',
    'domain':       '**`domain url`**\n\nDeclares the canonical domain for this agent, establishing cryptographic identity and ownership.',
    'license':      '**`license type`**\n\nDeclares the license under which this agent is distributed (e.g., MIT, Copyright).',
    'terms':        '**`terms url`**\n\nLink to the terms of service.',
    'privacy':      '**`privacy url`**\n\nLink to the privacy policy.',
    'description':  '**`description`**\n\nA brief description of the agent, used by the Runtime for semantic indexing.',
    'behavior':     '**`behavior file.flow`**\n\nThe `.flow` file that manages the state and transitions of this agent.',
    'requires':     '**`requires Type`**\n\nTypes (native or custom) that the Runtime must ensure exist in context before triggering the `.flow`.',
    'input':        '**`input Type`**\n\nThe input data types expected for this agent to operate.',
    'capabilities': '**`capabilities Action`**\n\nThe Actions or capabilities this agent can execute. Also acts as a Sandboxing Contract.',
    'output':       '**`output Type`**\n\nThe data type this agent returns.',
    'type':         '**`type name`**\n\nDeclares a custom type to anchor custom typing to Wikidata or Schema.org.',
    'concept':      '**`concept url`**\n\nThe Wikidata or Schema.org concept URL this type maps to.',
    'schema':       '**`schema file.json`**\n\nA JSON schema file for this type.',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectStates(document) {
    const results = [];
    const text = document.getText();
    const re = /^state\s+([a-zA-Z_][a-zA-Z0-9_.\-]*)/gm;
    let m;
    while ((m = re.exec(text)) !== null) {
        results.push({ name: m[1], offset: m.index + (m[0].length - m[1].length) });
    }
    return results;
}

function collectTypes(document) {
    const results = [];
    const text = document.getText();
    const re = /^type\s+([a-zA-Z0-9_.-]+)/gm;
    let m;
    while ((m = re.exec(text)) !== null) {
        results.push({ name: m[1], offset: m.index + (m[0].length - m[1].length) });
    }
    return results;
}

function getCurrentStateName(document, line) {
    for (let i = line; i >= 0; i--) {
        const m = document.lineAt(i).text.match(/^state\s+([a-zA-Z_][a-zA-Z0-9_.\-]*)/);
        if (m) return m[1];
    }
    return null;
}

// ─── Graph helpers ────────────────────────────────────────────────────────────

function parseFlowForGraph(text) {
    const states = [];
    const transitions = [];
    const entryPoints = [];

    const stateRe = /^state\s+([a-zA-Z_][a-zA-Z0-9_.\-]*)/gm;
    let m;
    while ((m = stateRe.exec(text)) !== null) states.push(m[1]);

    // Split into top-level segments at state / on event boundaries
    const segments = text.split(/(?=^(?:state|on\s+event)\s)/m);
    for (const seg of segments) {
        const stateM = seg.match(/^state\s+([a-zA-Z_][a-zA-Z0-9_.\-]*)/);
        const eventM = seg.match(/^on\s+event\s+"([^"]+)"/);
        if (stateM) {
            const from = stateM[1];
            const nextRe = /\bnext\s+([a-zA-Z_][a-zA-Z0-9_.\-]*)/g;
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

// ─── Formatting helpers ───────────────────────────────────────────────────────

const BLOCK_HEADERS = /^(on\s+(intent|escape|fallback|complete|failed)|if|else|after|parallel)\b/;
const TOP_LEVEL_LINE = /^(state|merge)\s|^on\s+event\b/;

function formatFlowDocument(document) {
    const edits = [];
    let mode = 'PREAMBLE'; // PREAMBLE | STATE_BODY | NESTED_BODY

    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const trimmed = line.text.trim();
        if (!trimmed) continue;

        let expectedIndent;
        if (TOP_LEVEL_LINE.test(trimmed)) {
            mode = /^state\s/.test(trimmed) ? 'STATE_BODY' : 'PREAMBLE';
            expectedIndent = 0;
        } else if (mode === 'PREAMBLE') {
            expectedIndent = 0;
        } else if (mode === 'STATE_BODY') {
            if (BLOCK_HEADERS.test(trimmed)) { mode = 'NESTED_BODY'; }
            expectedIndent = 2;
        } else { // NESTED_BODY
            expectedIndent = BLOCK_HEADERS.test(trimmed) ? 2 : 4;
        }

        const actualIndent = line.text.length - line.text.trimStart().length;
        if (actualIndent !== expectedIndent) {
            edits.push(new vscode.TextEdit(new vscode.Range(i, 0, i, actualIndent), ' '.repeat(expectedIndent)));
        }
    }
    return edits;
}

function formatAgentDocument(document) {
    const edits = [];
    for (let i = 0; i < document.lineCount; i++) {
        const line = document.lineAt(i);
        const trimmed = line.text.trim();
        if (!trimmed) continue;
        const expectedIndent = /^\s/.test(line.text) ? 2 : 0;
        const actualIndent = line.text.length - line.text.trimStart().length;
        if (actualIndent !== expectedIndent) {
            edits.push(new vscode.TextEdit(new vscode.Range(i, 0, i, actualIndent), ' '.repeat(expectedIndent)));
        }
    }
    return edits;
}

// ─── activate ─────────────────────────────────────────────────────────────────

function activate(context) {
    const AGENT_MODE = { language: 'agent', scheme: 'file' };
    const FLOW_MODE  = { language: 'flow',  scheme: 'file' };

    // ── 1. Hover Providers ──────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(AGENT_MODE, {
            provideHover(document, position) {
                const wr = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_]+/);
                if (!wr) return null;
                const word = document.getText(wr);
                return hoverDocs[word] ? new vscode.Hover(new vscode.MarkdownString(hoverDocs[word])) : null;
            }
        }),
        vscode.languages.registerHoverProvider(FLOW_MODE, {
            provideHover(document, position) {
                const wr = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_]+/);
                if (!wr) return null;
                const word = document.getText(wr);
                return flowHoverDocs[word] ? new vscode.Hover(new vscode.MarkdownString(flowHoverDocs[word])) : null;
            }
        })
    );

    // ── 2. Outline (Document Symbol Providers) ──────────────────────────────
    context.subscriptions.push(
        vscode.languages.registerDocumentSymbolProvider(AGENT_MODE, {
            provideDocumentSymbols(document) {
                const symbols = [];
                for (let i = 0; i < document.lineCount; i++) {
                    const text = document.lineAt(i).text;
                    const range = new vscode.Range(i, 0, i, text.length);
                    const agentM = text.match(/^agent\s+(.+)/);
                    if (agentM) symbols.push(new vscode.DocumentSymbol(agentM[1].trim(), 'Agent', vscode.SymbolKind.Class, range, range));
                    const typeM = text.match(/^type\s+([a-zA-Z0-9_.-]+)/);
                    if (typeM) symbols.push(new vscode.DocumentSymbol(typeM[1], 'Type', vscode.SymbolKind.Struct, range, range));
                }
                return symbols;
            }
        }),
        vscode.languages.registerDocumentSymbolProvider(FLOW_MODE, {
            provideDocumentSymbols(document) {
                const symbols = [];
                for (let i = 0; i < document.lineCount; i++) {
                    const text = document.lineAt(i).text;
                    const range = new vscode.Range(i, 0, i, text.length);
                    const stateM = text.match(/^state\s+([a-zA-Z_][a-zA-Z0-9_.\-]*)/);
                    if (stateM) symbols.push(new vscode.DocumentSymbol(stateM[1], 'State', vscode.SymbolKind.Class, range, range));
                    const eventM = text.match(/^on\s+event\s+"([^"]+)"/);
                    if (eventM) symbols.push(new vscode.DocumentSymbol('on event: ' + eventM[1], 'Global Observer', vscode.SymbolKind.Event, range, range));
                }
                return symbols;
            }
        })
    );

    // ── 3. Document Link Providers ──────────────────────────────────────────
    context.subscriptions.push(
        vscode.languages.registerDocumentLinkProvider(FLOW_MODE, {
            provideDocumentLinks(document) {
                const links = [];
                const text = document.getText();
                const re = /(?:run\s+(?:script|flow)|guide|teach|(?:apply|remove)\s+(?:css|html|video))\s+"([^"]+)"/g;
                let m;
                while ((m = re.exec(text)) !== null) {
                    const fp = m[1];
                    const qs = m.index + m[0].lastIndexOf('"' + fp + '"');
                    const range = new vscode.Range(document.positionAt(qs), document.positionAt(qs + fp.length + 2));
                    const wf = vscode.workspace.getWorkspaceFolder(document.uri);
                    if (wf) links.push(new vscode.DocumentLink(range, vscode.Uri.file(path.join(wf.uri.fsPath, fp))));
                }
                return links;
            }
        }),
        vscode.languages.registerDocumentLinkProvider(AGENT_MODE, {
            provideDocumentLinks(document) {
                const links = [];
                const text = document.getText();
                const re = /^(?:behavior|schema)\s+(\S+)/gm;
                let m;
                while ((m = re.exec(text)) !== null) {
                    const fp = m[1];
                    const fs = m.index + m[0].length - fp.length;
                    const range = new vscode.Range(document.positionAt(fs), document.positionAt(fs + fp.length));
                    const wf = vscode.workspace.getWorkspaceFolder(document.uri);
                    if (wf) links.push(new vscode.DocumentLink(range, vscode.Uri.file(path.join(wf.uri.fsPath, fp))));
                }
                return links;
            }
        })
    );

    // ── 4. Go-to-Definition Providers ───────────────────────────────────────
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(FLOW_MODE, {
            provideDefinition(document, position) {
                const wr = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_.]+/);
                if (!wr) return null;
                const word = document.getText(wr);
                const m = new RegExp(`^state\\s+${escapeRegex(word)}\\b`, 'm').exec(document.getText());
                if (!m) return null;
                const line = document.positionAt(m.index).line;
                return new vscode.Location(document.uri, new vscode.Range(line, 0, line, m[0].length));
            }
        }),
        vscode.languages.registerDefinitionProvider(AGENT_MODE, {
            provideDefinition(document, position) {
                const wr = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_.]+/);
                if (!wr) return null;
                const word = document.getText(wr);
                if (!/^[A-Z]/.test(word) && !word.includes('.')) return null;
                const m = new RegExp(`^type\\s+${escapeRegex(word)}\\b`, 'm').exec(document.getText());
                if (!m) return null;
                const line = document.positionAt(m.index).line;
                return new vscode.Location(document.uri, new vscode.Range(line, 0, line, m[0].length));
            }
        })
    );

    // ── 5. Completion Providers ─────────────────────────────────────────────
    const FLOW_TOP_KW    = ['state', 'merge', 'on event', 'on intent', 'on escape', 'on fallback'];
    const FLOW_BLOCK_KW  = ['guide', 'teach', 'goal', 'interact', 'run', 'next', 'set', 'if', 'else', 'after', 'parallel', 'apply', 'remove', 'on intent', 'on escape', 'on fallback', 'on complete', 'on failed'];
    const AGENT_TOP_KW   = ['agent', 'domain', 'license', 'terms', 'privacy', 'description', 'behavior', 'requires', 'input', 'capabilities', 'output', 'type', 'concept', 'schema'];
    const STRICT_BLOCKS  = new Set(['input', 'output', 'requires', 'capabilities']);

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(FLOW_MODE, {
            provideCompletionItems(document, position) {
                const line = document.lineAt(position);
                const before = line.text.substring(0, position.character);

                if (/\bnext\s+\S*$/.test(before)) {
                    return collectStates(document).map(s => {
                        const item = new vscode.CompletionItem(s.name, vscode.CompletionItemKind.Module);
                        item.detail = 'state';
                        return item;
                    });
                }
                if (/\bset\s+\S*$/.test(before)) {
                    return ['context.', 'session.', 'worksession.', 'user.'].map(d => {
                        const item = new vscode.CompletionItem(d, vscode.CompletionItemKind.Variable);
                        item.detail = 'memory domain';
                        return item;
                    });
                }
                if (/\brun\s+\S*$/.test(before)) {
                    return ['script', 'subagent', 'tool'].map(k => new vscode.CompletionItem(k, vscode.CompletionItemKind.Keyword));
                }
                if (/\bon\s+\S*$/.test(before)) {
                    return ['event', 'intent', 'escape', 'fallback', 'complete', 'failed'].map(k => new vscode.CompletionItem(k, vscode.CompletionItemKind.Keyword));
                }

                const kws = /^\s/.test(line.text) ? FLOW_BLOCK_KW : FLOW_TOP_KW;
                return kws.map(k => new vscode.CompletionItem(k, vscode.CompletionItemKind.Keyword));
            }
        }),
        vscode.languages.registerCompletionItemProvider(AGENT_MODE, {
            provideCompletionItems(document, position) {
                const line = document.lineAt(position);
                if (!/^\s/.test(line.text)) {
                    return AGENT_TOP_KW.map(k => new vscode.CompletionItem(k, vscode.CompletionItemKind.Keyword));
                }
                // Find enclosing block keyword
                for (let i = position.line - 1; i >= 0; i--) {
                    const prev = document.lineAt(i);
                    if (/^\s/.test(prev.text)) continue;
                    const kw = prev.text.trim().split(/\s+/)[0];
                    if (STRICT_BLOCKS.has(kw)) {
                        return collectTypes(document).map(t => {
                            const item = new vscode.CompletionItem(t.name, vscode.CompletionItemKind.Class);
                            item.detail = 'type';
                            return item;
                        });
                    }
                    break;
                }
                return [];
            }
        })
    );

    // ── 6. Rename Providers ─────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.languages.registerRenameProvider(FLOW_MODE, {
            prepareRename(document, position) {
                const wr = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_.]+/);
                if (!wr) return null;
                const lineText = document.lineAt(position.line).text;
                if (/^state\s+/.test(lineText) || /\bnext\s+/.test(lineText)) return wr;
                return null;
            },
            provideRenameEdits(document, position, newName) {
                const wr = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_.]+/);
                if (!wr) return null;
                const oldName = document.getText(wr);
                const text = document.getText();
                const edit = new vscode.WorkspaceEdit();
                const esc = escapeRegex(oldName);
                for (const re of [
                    new RegExp(`^(state\\s+)(${esc})\\b`, 'gm'),
                    new RegExp(`(\\bnext\\s+)(${esc})\\b`, 'g'),
                ]) {
                    let m;
                    while ((m = re.exec(text)) !== null) {
                        const s = document.positionAt(m.index + m[1].length);
                        const e = document.positionAt(m.index + m[1].length + oldName.length);
                        edit.replace(document.uri, new vscode.Range(s, e), newName);
                    }
                }
                return edit;
            }
        }),
        vscode.languages.registerRenameProvider(AGENT_MODE, {
            prepareRename(document, position) {
                const wr = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_.]+/);
                if (!wr) return null;
                const lineText = document.lineAt(position.line).text;
                if (/^type\s+/.test(lineText) || /^\s/.test(lineText)) return wr;
                return null;
            },
            provideRenameEdits(document, position, newName) {
                const wr = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_.]+/);
                if (!wr) return null;
                const oldName = document.getText(wr);
                const text = document.getText();
                const edit = new vscode.WorkspaceEdit();
                const esc = escapeRegex(oldName);
                for (const re of [
                    new RegExp(`^(type\\s+)(${esc})\\b`, 'gm'),
                    new RegExp(`^(\\s+)(${esc})\\b`, 'gm'),
                ]) {
                    let m;
                    while ((m = re.exec(text)) !== null) {
                        const s = document.positionAt(m.index + m[1].length);
                        const e = document.positionAt(m.index + m[1].length + oldName.length);
                        edit.replace(document.uri, new vscode.Range(s, e), newName);
                    }
                }
                return edit;
            }
        })
    );

    // ── 7. Find References Providers ────────────────────────────────────────
    context.subscriptions.push(
        vscode.languages.registerReferenceProvider(FLOW_MODE, {
            provideReferences(document, position) {
                const wr = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_.]+/);
                if (!wr) return [];
                const word = document.getText(wr);
                const text = document.getText();
                const locations = [];
                const esc = escapeRegex(word);
                for (const re of [
                    new RegExp(`^state\\s+(${esc})\\b`, 'gm'),
                    new RegExp(`\\bnext\\s+(${esc})\\b`, 'g'),
                ]) {
                    let m;
                    while ((m = re.exec(text)) !== null) {
                        const idx = m.index + m[0].indexOf(m[1]);
                        locations.push(new vscode.Location(document.uri, new vscode.Range(document.positionAt(idx), document.positionAt(idx + word.length))));
                    }
                }
                return locations;
            }
        }),
        vscode.languages.registerReferenceProvider(AGENT_MODE, {
            provideReferences(document, position) {
                const wr = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_.]+/);
                if (!wr) return [];
                const word = document.getText(wr);
                const text = document.getText();
                const locations = [];
                const esc = escapeRegex(word);
                for (const re of [
                    new RegExp(`^type\\s+(${esc})\\b`, 'gm'),
                    new RegExp(`^\\s+(${esc})\\b`, 'gm'),
                ]) {
                    let m;
                    while ((m = re.exec(text)) !== null) {
                        const idx = m.index + m[0].indexOf(m[1]);
                        locations.push(new vscode.Location(document.uri, new vscode.Range(document.positionAt(idx), document.positionAt(idx + word.length))));
                    }
                }
                return locations;
            }
        })
    );

    // ── 8. Code Actions ─────────────────────────────────────────────────────
    context.subscriptions.push(
        vscode.languages.registerCodeActionsProvider([FLOW_MODE, AGENT_MODE], {
            provideCodeActions(document, _range, ctx) {
                const actions = [];
                for (const diag of ctx.diagnostics) {
                    const missingState = diag.message.match(/State '([^']+)' is not defined in this file/);
                    if (missingState) {
                        const action = new vscode.CodeAction(`Create state '${missingState[1]}'`, vscode.CodeActionKind.QuickFix);
                        action.edit = new vscode.WorkspaceEdit();
                        action.edit.insert(document.uri, new vscode.Position(document.lineCount, 0), `\nstate ${missingState[1]}\n  guide ""\n  interact\n`);
                        action.diagnostics = [diag];
                        actions.push(action);
                    }
                    if (diag.message.includes('is deprecated or invalid')) {
                        const action = new vscode.CodeAction('Remove this line', vscode.CodeActionKind.QuickFix);
                        action.edit = new vscode.WorkspaceEdit();
                        action.edit.delete(document.uri, document.lineAt(diag.range.start.line).rangeIncludingLineBreak);
                        action.diagnostics = [diag];
                        actions.push(action);
                    }
                    if (diag.message.includes('traps the agent')) {
                        const action = new vscode.CodeAction("Add 'on intent' handler", vscode.CodeActionKind.QuickFix);
                        action.edit = new vscode.WorkspaceEdit();
                        action.edit.insert(document.uri, new vscode.Position(diag.range.start.line + 1, 0), `  on intent ""\n    next \n`);
                        action.diagnostics = [diag];
                        actions.push(action);
                    }
                }
                return actions;
            }
        }, { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] })
    );

    // ── 9. Workspace Symbol Provider ────────────────────────────────────────
    context.subscriptions.push(
        vscode.languages.registerWorkspaceSymbolProvider({
            async provideWorkspaceSymbols(query) {
                const symbols = [];
                const q = query.toLowerCase();
                const hit = name => !q || name.toLowerCase().includes(q);

                const [flowFiles, agentFiles] = await Promise.all([
                    vscode.workspace.findFiles('**/*.flow', '**/node_modules/**'),
                    vscode.workspace.findFiles('**/*.agent', '**/node_modules/**'),
                ]);

                for (const uri of flowFiles) {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    const text = doc.getText();
                    let m;
                    const stateRe = /^state\s+([a-zA-Z_][a-zA-Z0-9_.\-]*)/gm;
                    while ((m = stateRe.exec(text)) !== null) {
                        if (hit(m[1])) symbols.push(new vscode.SymbolInformation(m[1], vscode.SymbolKind.Class, '', new vscode.Location(uri, doc.positionAt(m.index))));
                    }
                    const eventRe = /^on\s+event\s+"([^"]+)"/gm;
                    while ((m = eventRe.exec(text)) !== null) {
                        if (hit(m[1])) symbols.push(new vscode.SymbolInformation('on event: ' + m[1], vscode.SymbolKind.Event, '', new vscode.Location(uri, doc.positionAt(m.index))));
                    }
                }

                for (const uri of agentFiles) {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    const text = doc.getText();
                    let m;
                    const agentRe = /^agent\s+(.+)/gm;
                    while ((m = agentRe.exec(text)) !== null) {
                        const name = m[1].trim();
                        if (hit(name)) symbols.push(new vscode.SymbolInformation(name, vscode.SymbolKind.Class, '', new vscode.Location(uri, doc.positionAt(m.index))));
                    }
                    const typeRe = /^type\s+([a-zA-Z0-9_.-]+)/gm;
                    while ((m = typeRe.exec(text)) !== null) {
                        if (hit(m[1])) symbols.push(new vscode.SymbolInformation(m[1], vscode.SymbolKind.Struct, '', new vscode.Location(uri, doc.positionAt(m.index))));
                    }
                }

                return symbols;
            }
        })
    );

    // ── 10. Document Formatting Providers ───────────────────────────────────
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(FLOW_MODE, {
            provideDocumentFormattingEdits(document) { return formatFlowDocument(document); }
        }),
        vscode.languages.registerDocumentFormattingEditProvider(AGENT_MODE, {
            provideDocumentFormattingEdits(document) { return formatAgentDocument(document); }
        })
    );

    // ── 11. Folding Range Providers ─────────────────────────────────────────
    context.subscriptions.push(
        vscode.languages.registerFoldingRangeProvider(FLOW_MODE, {
            provideFoldingRanges(document) {
                const markers = [];
                for (let i = 0; i < document.lineCount; i++) {
                    if (/^state\s|^on\s+event\s/.test(document.lineAt(i).text)) markers.push(i);
                }
                return markers.map((start, i) => {
                    const end = i + 1 < markers.length ? markers[i + 1] - 1 : document.lineCount - 1;
                    return end > start ? new vscode.FoldingRange(start, end) : null;
                }).filter(Boolean);
            }
        }),
        vscode.languages.registerFoldingRangeProvider(AGENT_MODE, {
            provideFoldingRanges(document) {
                const TOP_KWS = new Set(['agent', 'domain', 'license', 'terms', 'privacy', 'description', 'behavior', 'requires', 'input', 'capabilities', 'output', 'type', 'concept', 'schema']);
                const markers = [];
                for (let i = 0; i < document.lineCount; i++) {
                    const line = document.lineAt(i);
                    if (!/^\s/.test(line.text) && line.text.trim()) {
                        const kw = line.text.trim().split(/\s+/)[0];
                        if (TOP_KWS.has(kw)) markers.push(i);
                    }
                }
                return markers.map((start, i) => {
                    const end = i + 1 < markers.length ? markers[i + 1] - 1 : document.lineCount - 1;
                    return end > start ? new vscode.FoldingRange(start, end) : null;
                }).filter(Boolean);
            }
        })
    );

    // ── 12. Status Bar ──────────────────────────────────────────────────────
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    context.subscriptions.push(statusBar);

    function updateStatusBar(editor) {
        if (!editor || editor.document.languageId !== 'flow') { statusBar.hide(); return; }
        const name = getCurrentStateName(editor.document, editor.selection.active.line);
        if (name) {
            statusBar.text = `$(symbol-class) ${name}`;
            statusBar.tooltip = `Current flow state: ${name}`;
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

    // ── 13. Visual Graph Command ────────────────────────────────────────────
    let graphPanel = null;

    function refreshGraph(text) {
        if (graphPanel) graphPanel.webview.html = getGraphHtml(generateMermaid(parseFlowForGraph(text)));
    }

    context.subscriptions.push(
        vscode.commands.registerCommand('flow.openGraph', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'flow') {
                vscode.window.showWarningMessage('Open a .flow file to view its graph.');
                return;
            }
            if (graphPanel) {
                graphPanel.reveal(vscode.ViewColumn.Beside);
            } else {
                graphPanel = vscode.window.createWebviewPanel('flowGraph', 'Flow Graph', vscode.ViewColumn.Beside, { enableScripts: true });
                graphPanel.onDidDispose(() => { graphPanel = null; }, null, context.subscriptions);
            }
            refreshGraph(editor.document.getText());
        }),
        vscode.workspace.onDidSaveTextDocument(doc => {
            if (doc.languageId === 'flow') refreshGraph(doc.getText());
        })
    );

    // ── 14. Diagnostics ─────────────────────────────────────────────────────
    const agentDiag = vscode.languages.createDiagnosticCollection('agent');
    const flowDiag  = vscode.languages.createDiagnosticCollection('flow');
    context.subscriptions.push(agentDiag, flowDiag);

    function updateAgentDiagnostics(document) {
        if (document.languageId !== 'agent') return;
        const diagnostics = [];
        const deprecated = new Set(['do', 'server', 'endpoint', 'author', 'version', 'requirements', 'step', 'softwareVersion', 'applicationCategory', 'character', 'publishingPrinciples']);
        const declaredTypes = new Set(collectTypes(document).map(t => t.name));
        let currentBlock = null;

        for (let i = 0; i < document.lineCount; i++) {
            const raw = document.lineAt(i).text;
            const text = raw.split('//')[0].trim();
            if (!text) continue;
            const wordM = text.match(/^([a-zA-Z0-9_.-]+)\b/);
            if (!wordM) continue;
            const word = wordM[1];

            if (deprecated.has(word)) {
                const col = raw.indexOf(word);
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, col, i, col + word.length), `The keyword '${word}' is deprecated or invalid in the current .agent specification. Please use the updated syntax.`, vscode.DiagnosticSeverity.Error));
            }

            const isIndented = raw.startsWith('  ') || raw.startsWith('\t');
            if (!isIndented) {
                currentBlock = word;
                if (STRICT_BLOCKS.has(word)) {
                    const remainder = text.substring(word.length).trim();
                    if (remainder && !/^([a-zA-Z0-9_.-]+)(\s*,\s*[a-zA-Z0-9_.-]+)*$/.test(remainder)) {
                        const col = raw.indexOf(remainder);
                        diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, col, i, col + remainder.length), `Strict Lint: Invalid Compact Mode format. Expected comma-separated Types: Type1, Type2.`, vscode.DiagnosticSeverity.Error));
                    }
                }
            } else if (STRICT_BLOCKS.has(currentBlock)) {
                if (!/^([a-zA-Z0-9_.-]+)(\s+"[^"]*")?$/.test(text)) {
                    const col = raw.indexOf(text);
                    diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, col, i, col + text.length), `Strict Lint: Invalid Documented Mode format in ${currentBlock}. Expected: Type or Type "Description".`, vscode.DiagnosticSeverity.Error));
                } else if (declaredTypes.size > 0) {
                    const typeName = text.match(/^([a-zA-Z0-9_.-]+)/)[1];
                    if (!declaredTypes.has(typeName)) {
                        const col = raw.indexOf(typeName);
                        diagnostics.push(new vscode.Diagnostic(new vscode.Range(i, col, i, col + typeName.length), `Type '${typeName}' is not declared in this file (assuming native or external).`, vscode.DiagnosticSeverity.Warning));
                    }
                }
            }
        }
        agentDiag.set(document.uri, diagnostics);
    }

    function updateFlowDiagnostics(document) {
        if (document.languageId !== 'flow') return;
        const diagnostics = [];
        const text = document.getText();
        const states = new Set(collectStates(document).map(s => s.name));

        // Rule 1: Dangling transitions
        const nextRe = /\bnext\s+([a-zA-Z0-9_.]+)/g;
        let m;
        while ((m = nextRe.exec(text)) !== null) {
            const target = m[1];
            if (!states.has(target)) {
                const external = target.includes('.');
                const start = document.positionAt(m.index + m[0].indexOf(target));
                const end   = document.positionAt(m.index + m[0].length);
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(start, end), external ? `State '${target}' is not defined locally (assuming external flow reference).` : `State '${target}' is not defined in this file.`, external ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error));
            }
        }

        // Rule 2: Dead-end interact
        const blocks = text.split(/^state\s+/m);
        let offset = blocks[0].length;
        for (let i = 1; i < blocks.length; i++) {
            const block = blocks[i];
            if (block.includes('interact') && !/next\s+/.test(block) && !/on\s+(?:intent|escape)/.test(block)) {
                const idx = block.indexOf('interact');
                const name = (block.match(/^([a-zA-Z0-9_.]+)/) || ['', '?'])[1];
                diagnostics.push(new vscode.Diagnostic(new vscode.Range(document.positionAt(offset + idx), document.positionAt(offset + idx + 8)), `State '${name}' calls interact but has no 'next' or 'on intent/escape'. This will trap the agent.`, vscode.DiagnosticSeverity.Warning));
            }
            offset += block.length + 6;
        }

        flowDiag.set(document.uri, diagnostics);
    }

    function updateDiagnostics(document) {
        updateAgentDiagnostics(document);
        updateFlowDiagnostics(document);
    }

    if (vscode.window.activeTextEditor) updateDiagnostics(vscode.window.activeTextEditor.document);
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(e => updateDiagnostics(e.document)),
        vscode.workspace.onDidOpenTextDocument(updateDiagnostics),
        vscode.workspace.onDidCloseTextDocument(doc => { agentDiag.delete(doc.uri); flowDiag.delete(doc.uri); })
    );
}

function deactivate() {}

module.exports = { activate, deactivate };
