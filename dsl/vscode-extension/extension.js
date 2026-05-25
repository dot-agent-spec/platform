const vscode = require('vscode');

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
    'agent': '**`agent name`**\n\nDeclares a new agent. The central node of the manifest.',
    'domain': '**`domain url`**\n\nDeclares the canonical domain for this agent, establishing cryptographic identity and ownership.',
    'license': '**`license type`**\n\nDeclares the license under which this agent is distributed (e.g., MIT, Copyright).',
    'terms': '**`terms url`**\n\nLink to the terms of service.',
    'privacy': '**`privacy url`**\n\nLink to the privacy policy.',
    'description': '**`description`**\n\nA brief description of the agent, used by the Runtime for semantic indexing.',
    'behavior': '**`behavior file.flow`**\n\nThe `.flow` file that manages the state and transitions of this agent.',
    'requires': '**`requires Type`**\n\nTypes (native or custom) that the Runtime must ensure exist in context before triggering the `.flow`.',
    'input': '**`input Type`**\n\nThe input data types expected for this agent to operate.',
    'capabilities': '**`capabilities Action`**\n\nThe Actions or capabilities this agent can execute. Also acts as a Sandboxing Contract.',
    'output': '**`output Type`**\n\nThe data type this agent returns.',
    'type': '**`type name`**\n\nDeclares a custom type to anchor custom typing to Wikidata or Schema.org.',
    'concept': '**`concept url`**\n\nThe Wikidata or Schema.org concept URL this type maps to.',
    'schema': '**`schema file.json`**\n\nA JSON schema file for this type.'
};

function activate(context) {
    const AGENT_MODE = { language: 'agent', scheme: 'file' };
    const FLOW_MODE  = { language: 'flow',  scheme: 'file' };

    // Hover Provider — .agent
    const hoverProvider = vscode.languages.registerHoverProvider(AGENT_MODE, {
        provideHover(document, position, token) {
            const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_]+/);
            if (!wordRange) return null;
            const word = document.getText(wordRange);
            if (hoverDocs[word]) {
                return new vscode.Hover(new vscode.MarkdownString(hoverDocs[word]));
            }
            return null;
        }
    });

    // Hover Provider — .flow
    const flowHoverProvider = vscode.languages.registerHoverProvider(FLOW_MODE, {
        provideHover(document, position, token) {
            const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z0-9_]+/);
            if (!wordRange) return null;
            const word = document.getText(wordRange);
            if (flowHoverDocs[word]) {
                return new vscode.Hover(new vscode.MarkdownString(flowHoverDocs[word]));
            }
            return null;
        }
    });

    // Document Symbol Provider (Outline) — .agent
    const symbolProvider = vscode.languages.registerDocumentSymbolProvider(AGENT_MODE, {
        provideDocumentSymbols(document, token) {
            const symbols = [];
            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i);

                // Match agent declarations (supports multi-word names: "agent Mickey Mouse")
                const agentMatch = line.text.match(/^agent\s+(.+)/);
                if (agentMatch) {
                    const name = agentMatch[1].trim();
                    const range = new vscode.Range(i, 0, i, line.text.length);
                    const symbol = new vscode.DocumentSymbol(
                        name,
                        'Agent',
                        vscode.SymbolKind.Class,
                        range,
                        range
                    );
                    symbols.push(symbol);
                }

                // Match type declarations
                const typeMatch = line.text.match(/^type\s+([a-zA-Z0-9_.-]+)/);
                if (typeMatch) {
                    const name = typeMatch[1];
                    const range = new vscode.Range(i, 0, i, line.text.length);
                    const symbol = new vscode.DocumentSymbol(
                        name,
                        'Type',
                        vscode.SymbolKind.Struct,
                        range,
                        range
                    );
                    symbols.push(symbol);
                }
            }
            return symbols;
        }
    });

    // Document Symbol Provider (Outline) — .flow
    const flowSymbolProvider = vscode.languages.registerDocumentSymbolProvider(FLOW_MODE, {
        provideDocumentSymbols(document, token) {
            const symbols = [];
            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i);

                // Match state declarations
                const stateMatch = line.text.match(/^state\s+([a-zA-Z_][a-zA-Z0-9_.\\-]*)/);
                if (stateMatch) {
                    const name = stateMatch[1];
                    const range = new vscode.Range(i, 0, i, line.text.length);
                    symbols.push(new vscode.DocumentSymbol(
                        name,
                        'State',
                        vscode.SymbolKind.Module,
                        range,
                        range
                    ));
                }

                // Match top-level event triggers
                const triggerMatch = line.text.match(/^on\s+event\s+"([^"]+)"/);
                if (triggerMatch) {
                    const name = triggerMatch[1];
                    const range = new vscode.Range(i, 0, i, line.text.length);
                    symbols.push(new vscode.DocumentSymbol(
                        name,
                        'Event',
                        vscode.SymbolKind.Event,
                        range,
                        range
                    ));
                }
            }
            return symbols;
        }
    });

    // Diagnostics / Linter
    const diagnosticCollection = vscode.languages.createDiagnosticCollection('agent');
    
    function updateDiagnostics(document) {
        if (document.languageId !== 'agent') return;
        
        const diagnostics = [];
        const text = document.getText();
        
        // Find deprecated or invalid keywords
        const deprecatedKeywords = ['do', 'server', 'endpoint', 'author', 'version', 'requirements', 'step', 'softwareVersion', 'applicationCategory', 'character', 'publishingPrinciples'];
        
        let currentBlock = null;
        const strictBlocks = ['input', 'output', 'capabilities', 'requires'];
        
        for (let i = 0; i < document.lineCount; i++) {
            const line = document.lineAt(i);
            const rawText = line.text;
            const textWithoutComment = rawText.split('//')[0];
            const text = textWithoutComment.trim();
            
            if (!text) continue;
            
            const match = text.match(/^\s*([a-zA-Z0-9_.-]+)\b/);
            if (!match) continue;
            
            const word = match[1];
            if (deprecatedKeywords.includes(word)) {
                const startPos = new vscode.Position(i, rawText.indexOf(word));
                const endPos = new vscode.Position(i, rawText.indexOf(word) + word.length);
                diagnostics.push(new vscode.Diagnostic(
                    new vscode.Range(startPos, endPos),
                    `The keyword '${word}' is deprecated or invalid in the current .agent specification. Please use the updated syntax.`,
                    vscode.DiagnosticSeverity.Error
                ));
            }

            const isIndented = rawText.startsWith('  ') || rawText.startsWith('\t');
            if (!isIndented) {
                currentBlock = word;
                if (strictBlocks.includes(currentBlock)) {
                    const remainder = text.substring(word.length).trim();
                    if (remainder) {
                        // Compact mode (inline): comma-separated types
                        const isValid = /^([a-zA-Z0-9_.-]+)(\s*,\s*[a-zA-Z0-9_.-]+)*$/.test(remainder);
                        if (!isValid) {
                            const startPos = new vscode.Position(i, rawText.indexOf(remainder));
                            const endPos = new vscode.Position(i, rawText.indexOf(remainder) + remainder.length);
                            diagnostics.push(new vscode.Diagnostic(
                                new vscode.Range(startPos, endPos),
                                `Strict Lint: Invalid Compact Mode format. Expected comma-separated Types: Type1, Type2.`,
                                vscode.DiagnosticSeverity.Error
                            ));
                        }
                    }
                }
            } else {
                if (strictBlocks.includes(currentBlock)) {
                    // Documented mode: Type followed optionally by a quoted string literal
                    const isValid = /^([a-zA-Z0-9_.-]+)(\s+"[^"]*")?$/.test(text);
                    if (!isValid) {
                        const startPos = new vscode.Position(i, rawText.indexOf(text));
                        const endPos = new vscode.Position(i, rawText.indexOf(text) + text.length);
                        diagnostics.push(new vscode.Diagnostic(
                            new vscode.Range(startPos, endPos),
                            `Strict Lint: Invalid Documented Mode format in ${currentBlock}. Expected: Type or Type "Description".`,
                            vscode.DiagnosticSeverity.Error
                        ));
                    }
                }
            }
        }

        diagnosticCollection.set(document.uri, diagnostics);
    }

    if (vscode.window.activeTextEditor) {
        updateDiagnostics(vscode.window.activeTextEditor.document);
    }
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(e => updateDiagnostics(e.document)),
        vscode.workspace.onDidOpenTextDocument(updateDiagnostics),
        vscode.workspace.onDidCloseTextDocument(doc => diagnosticCollection.delete(doc.uri))
    );

    context.subscriptions.push(
        hoverProvider, flowHoverProvider,
        symbolProvider, flowSymbolProvider,
        diagnosticCollection
    );
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
