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

'use strict';

const { DiagnosticSeverity } = require('vscode-languageserver');
const { nodesOfType, nodeToRange } = require('../parser');

const DEPRECATED_AGENT_KW = new Set([
    'do', 'server', 'endpoint', 'author', 'version', 'requirements', 'step',
    'softwareVersion', 'applicationCategory', 'character', 'publishingPrinciples',
]);

const STRICT_BLOCK_TYPES = {
    input_block:        'input',
    output_block:       'output',
    requires_block:     'requires',
    capabilities_block: 'capabilities',
};

function diagnoseAgent(tree, text) {
    const diagnostics = [];

    // ── Deprecated keywords: line scan (no tree-sitter benefit here) ──────────
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const stripped = raw.split('//')[0].trim();
        if (!stripped) continue;
        const wordM = stripped.match(/^([a-zA-Z0-9_.-]+)\b/);
        if (!wordM) continue;
        const word = wordM[1];
        if (DEPRECATED_AGENT_KW.has(word)) {
            const col = raw.indexOf(word);
            diagnostics.push({
                range: { start: { line: i, character: col }, end: { line: i, character: col + word.length } },
                message: `The keyword '${word}' is deprecated or invalid in the current .agent specification.`,
                severity: DiagnosticSeverity.Error,
                source: 'agent-dsl',
            });
        }
    }

    // ── Strict block validation ───────────────────────────────────────────────
    const declaredTypes = new Set(
        nodesOfType(tree, 'type_decl')
            .map(n => n.childForFieldName('name')?.text)
            .filter(Boolean)
    );

    for (const [blockType, blockName] of Object.entries(STRICT_BLOCK_TYPES)) {
        for (const blockNode of nodesOfType(tree, blockType)) {
            // Syntax errors inside the block
            for (const errorNode of blockNode.descendantsOfType('ERROR')) {
                diagnostics.push({
                    range: nodeToRange(errorNode),
                    message: `Syntax error in '${blockName}' block. Expected: Type or Type "Description", or compact: Type1, Type2.`,
                    severity: DiagnosticSeverity.Error,
                    source: 'agent-dsl',
                });
            }

            // Undeclared type references (semantic warning)
            if (declaredTypes.size > 0) {
                for (const typeRefNode of blockNode.descendantsOfType('type_ref')) {
                    const idNode = typeRefNode.firstNamedChild;
                    if (!idNode) continue;
                    const typeName = idNode.text;
                    if (!declaredTypes.has(typeName)) {
                        diagnostics.push({
                            range: nodeToRange(idNode),
                            message: `Type '${typeName}' is not declared in this file (assuming native or external).`,
                            severity: DiagnosticSeverity.Warning,
                            source: 'agent-dsl',
                        });
                    }
                }
            }
        }
    }

    return diagnostics;
}

function diagnoseFlow(tree) {
    const diagnostics = [];

    // ── Rule 1: Dangling transitions ──────────────────────────────────────────
    const definedStates = new Set(
        nodesOfType(tree, 'state_decl')
            .map(n => n.childForFieldName('name')?.text)
            .filter(Boolean)
    );

    function checkTransitionTarget(stateNode) {
        if (!stateNode) return;
        const target = stateNode.text;
        if (!definedStates.has(target)) {
            const external = target.includes('.');
            diagnostics.push({
                range: nodeToRange(stateNode),
                message: external
                    ? `State '${target}' is not defined locally (assuming external flow reference).`
                    : `State '${target}' is not defined in this file.`,
                severity: external ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
                source: 'behavior-dsl',
            });
        }
    }

    for (const n of nodesOfType(tree, 'transition_stmt')) {
        checkTransitionTarget(n.childForFieldName('state'));
    }
    for (const n of nodesOfType(tree, 'intent_trigger')) {
        // inline form: on intent "..." next <state>
        checkTransitionTarget(n.childForFieldName('state'));
    }

    // ── Rule 2: Dead-end interact ─────────────────────────────────────────────
    for (const interactNode of nodesOfType(tree, 'interact_stmt')) {
        let ancestor = interactNode.parent;
        while (ancestor && ancestor.type !== 'state_decl') {
            ancestor = ancestor.parent;
        }
        if (!ancestor) continue;

        const hasNext   = ancestor.descendantsOfType('transition_stmt').length > 0;
        const hasIntent = ancestor.descendantsOfType('intent_trigger').length > 0;
        const hasOfftopic = ancestor.descendantsOfType('offtopic_stmt').length > 0;

        if (!hasNext && !hasIntent && !hasOfftopic) {
            diagnostics.push({
                range: nodeToRange(interactNode),
                message: "This state calls interact but has no 'transition' or 'on intent/offtopic'. This will trap the agent.",
                severity: DiagnosticSeverity.Warning,
                source: 'behavior-dsl',
            });
        }
    }

    return diagnostics;
}

function diagnose(langId, tree, text) {
    if (!tree) return [];
    if (langId === 'agent') return diagnoseAgent(tree, text);
    if (langId === 'behavior')  return diagnoseFlow(tree);
    return [];
}

module.exports = { diagnose };
