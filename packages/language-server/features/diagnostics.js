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

const fs = require('fs');
const { fileURLToPath } = require('url');
const path = require('path');
const { DiagnosticSeverity } = require('vscode-languageserver');
const { nodesOfType, nodeToRange, parseText } = require('../parser');

const STRICT_BLOCK_TYPES = {
    input_block:        'input',
    output_block:       'output',
    requires_block:     'requires',
    capabilities_block: 'capabilities',
};

function diagnoseDescription(tree, text) {
    const diagnostics = [];

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
                    source: 'description-dsl',
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
                            source: 'description-dsl',
                        });
                    }
                }
            }
        }
    }

    return diagnostics;
}

// Coleta recursivamente todos os state names declarados nos arquivos mergeados.
// visited (Set<absPath>) evita loops em grafos de merge circulares.
function collectMergedStates(tree, docDir, definedStates, visited = new Set()) {
    for (const mergeNode of nodesOfType(tree, 'merge_decl')) {
        const pathNode = mergeNode.childForFieldName('path');
        if (!pathNode) continue;
        const filename = pathNode.text.replace(/^"|"$/g, '');
        const absPath = path.resolve(docDir, filename);
        if (visited.has(absPath)) continue;
        visited.add(absPath);
        let mergedText;
        try { mergedText = fs.readFileSync(absPath, 'utf8'); } catch { continue; }
        const mergedTree = parseText('behavior', mergedText);
        if (!mergedTree) continue;
        nodesOfType(mergedTree, 'state_decl').forEach(n => {
            const name = n.childForFieldName('name')?.text;
            if (name) definedStates.add(name);
        });
        collectMergedStates(mergedTree, path.dirname(absPath), definedStates, visited);
    }
}

// Coleta erros de sintaxe (nós ERROR e MISSING) para que a causa real apareça
// sublinhada no editor, e não apenas o efeito colateral (ex.: "state not defined").
// Reporta apenas o ERROR mais externo de cada ramo, e tokens MISSING (ex.: falta 'to').
function collectSyntaxErrors(root, diagnostics) {
    const seen = new Set();

    function push(node, message) {
        const key = `${node.startIndex}:${node.endIndex}:${message}`;
        if (seen.has(key)) return;
        seen.add(key);
        diagnostics.push({
            range: nodeToRange(node),
            message,
            severity: DiagnosticSeverity.Error,
            source: 'behavior-dsl',
        });
    }

    function walk(node) {
        if (node.isMissing) {
            push(node, `Syntax error: missing '${node.type}'.`);
            return;
        }
        if (node.type === 'ERROR') {
            // Reporta o ERROR mais profundo (folha) para apontar o token preciso,
            // em vez do span externo que pode embrulhar o bloco inteiro.
            const hasNestedError = node.descendantsOfType('ERROR').some(e => e.id !== node.id);
            if (!hasNestedError) {
                const snippet = node.text.replace(/\s+/g, ' ').trim().slice(0, 40);
                push(node, snippet ? `Syntax error near '${snippet}'.` : 'Syntax error.');
                return;
            }
            // tem ERROR aninhado → desce para reportar o(s) mais específico(s)
        }
        for (const child of node.children) walk(child);
    }

    walk(root);
}

function diagnoseBehavior(tree, docUri) {
    const diagnostics = [];

    // ── Rule 0: Syntax errors (ERROR / MISSING nodes) ─────────────────────────
    collectSyntaxErrors(tree.rootNode, diagnostics);

    // ── Rule 1: Dangling transitions ──────────────────────────────────────────
    const definedStates = new Set(
        nodesOfType(tree, 'state_decl')
            .map(n => n.childForFieldName('name')?.text)
            .filter(Boolean)
    );

    // Enriquecer com estados de arquivos mergeados (recursivo, anti-loop)
    try {
        const docDir = path.dirname(fileURLToPath(docUri));
        collectMergedStates(tree, docDir, definedStates);
    } catch { /* URI inválida ou sem acesso — diagnostica apenas com estados locais */ }

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

    // ── Rule 2: Dead-end interact (now redundant but kept for safety) ────────────
    // With the new grammar, oriented_state_body requires repeat1(handlers),
    // so dead-end interact is structurally impossible. But kept for edge cases.
    for (const interactNode of nodesOfType(tree, 'interact_stmt')) {
        let ancestor = interactNode.parent;
        while (ancestor && ancestor.type !== 'oriented_state_body' && ancestor.type !== 'state_decl') {
            ancestor = ancestor.parent;
        }
        if (!ancestor) continue;

        // With new grammar: oriented_state_body always has handlers after interact (repeat1)
        // So this check should never trigger, but kept for robustness
        const hasHandlers = ancestor.descendantsOfType('intent_handler').length +
                           ancestor.descendantsOfType('offtopic_handler').length > 0;

        if (!hasHandlers) {
            diagnostics.push({
                range: nodeToRange(interactNode),
                message: "This state calls interact but has no handlers (on intent/offtopic). This will trap the agent.",
                severity: DiagnosticSeverity.Warning,
                source: 'behavior-dsl',
            });
        }
    }

    return diagnostics;
}

function diagnose(langId, tree, text, uri) {
    if (!tree) return [];
    if (langId === 'description') return diagnoseDescription(tree, text);
    if (langId === 'behavior')  return diagnoseBehavior(tree, uri);
    return [];
}

module.exports = { diagnose };
