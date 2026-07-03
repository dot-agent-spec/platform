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

// Workspace-discovery for the merge graph. This is IDE/tooling concern (it
// scans a directory nobody explicitly pointed us at), not compiler concern
// (the compiler only resolves imports from a known entry point, in
// consolidate()) — but it still belongs in the *server*, not the VS Code
// extension: the extension is a thin stdio transport with no fs access of
// its own (see apps/vscode-extension/extension.js), and the server already
// reads sibling files directly off disk for `agent/behaviorGraph`. That's
// the standard LSP shape — tsserver/rust-analyzer scan their own project
// tree server-side too, bounded by `workspaceFolders` from `initialize`.

import { readdir, readFile } from 'node:fs/promises';
import { join, dirname, resolve, relative, normalize, isAbsolute } from 'node:path';
import { parseBehaviorFile, initBehaviorParser } from '@dot-agent/compiler';

let workspaceRoots = [];

/** Called once from onInitialize with the client's workspaceFolders/rootUri, as absolute fs paths. */
export function setWorkspaceRoots(roots) {
    workspaceRoots = roots.map(r => normalize(resolve(r)));
}

// Safety bound for the upward walk when no workspace boundary is known
// (e.g. a single file opened outside any workspace folder).
const MAX_UPWARD_HOPS = 8;

/**
 * Finds the agent root for `startDir`: the nearest ancestor directory
 * containing a `*.description` file, mirroring the convention pack.ts's
 * discoverDescriptionFile() uses to define an agent bundle. The walk never
 * goes above a known workspace folder. Returns null if no manifest is found
 * within bounds.
 */
export async function findAgentRoot(startDir) {
    let dir = normalize(resolve(startDir));
    const boundary = workspaceRoots.find(root => !relative(root, dir).startsWith('..')) ?? null;

    for (let hops = 0; hops < MAX_UPWARD_HOPS; hops++) {
        let entries;
        try {
            entries = await readdir(dir);
        } catch {
            return null;
        }
        if (entries.some(f => f.endsWith('.description'))) return dir;
        if (boundary && dir === boundary) return null;
        const parent = dirname(dir);
        if (parent === dir) return null; // filesystem root
        dir = parent;
    }
    return null;
}

async function collectBehaviorFiles(root, subdir = '', depth = 0, maxDepth = 6, out = []) {
    if (depth > maxDepth) return out;
    let entries;
    try {
        entries = await readdir(join(root, subdir), { withFileTypes: true });
    } catch {
        return out;
    }
    for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const rel = subdir ? `${subdir}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
            await collectBehaviorFiles(root, rel, depth + 1, maxDepth, out);
        } else if (entry.name.endsWith('.behavior')) {
            out.push(rel);
        }
    }
    return out;
}

/**
 * Walks merge edges backward from `currentFile` (path relative to
 * `agentRoot`) to find the root of its merge component. Returns null if no
 * `.behavior` file under `agentRoot` merges `currentFile` (directly or
 * transitively).
 */
export async function findMergeRoot(agentRoot, currentFile) {
    // parseBehaviorFile() below calls straight into the WASM behavior-parser;
    // unlike lintBehavior()/consolidate(), this function can run before
    // anything else has triggered that init, so it must guard it itself.
    await initBehaviorParser();
    const normRoot = normalize(resolve(agentRoot));
    const behaviorFiles = await collectBehaviorFiles(normRoot);

    const parentOf = new Map();
    for (const relEntry of behaviorFiles) {
        const entryAbs = join(normRoot, relEntry);
        let fileText;
        try {
            fileText = await readFile(entryAbs, 'utf-8');
        } catch {
            continue;
        }
        const merges = parseBehaviorFile(fileText).ok?.merges ?? [];
        for (const mergePath of merges) {
            if (isAbsolute(mergePath)) continue;
            const mergeRel = relative(normRoot, resolve(dirname(entryAbs), mergePath));
            if (mergeRel.startsWith('..')) continue; // merge escapes the agent root — not this lookup's concern
            if (!parentOf.has(mergeRel)) parentOf.set(mergeRel, relEntry);
        }
    }

    let node = currentFile;
    const seen = new Set([node]);
    while (parentOf.has(node)) {
        node = parentOf.get(node);
        if (seen.has(node)) return null; // circular merge — let consolidate() report E013
        seen.add(node);
    }
    return node === currentFile ? null : node;
}
