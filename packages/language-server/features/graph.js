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

const { nodesOfType } = require('../parser');

function extractBehaviorGraph(tree) {
    const states = nodesOfType(tree, 'state_decl')
        .map(n => n.childForFieldName('name')?.text)
        .filter(Boolean);

    const transitions = [];
    const seen = new Set();
    for (const stateNode of nodesOfType(tree, 'state_decl')) {
        const from = stateNode.childForFieldName('name')?.text;
        if (!from) continue;
        for (const t of stateNode.descendantsOfType('transition_stmt')) {
            const to = t.childForFieldName('state')?.text;
            if (to) {
                const key = `${from}→${to}`;
                if (!seen.has(key)) { seen.add(key); transitions.push({ from, to }); }
            }
        }
    }

    const entryPoints = [];
    for (const triggerNode of nodesOfType(tree, 'trigger_decl')) {
        // event field is a quoted_string WITHOUT surrounding quotes (quotes are literals in the grammar rule)
        const eventText = triggerNode.childForFieldName('event')?.text;
        for (const t of triggerNode.descendantsOfType('transition_stmt')) {
            const to = t.childForFieldName('state')?.text;
            if (eventText && to) entryPoints.push({ event: eventText, to });
        }
    }

    return { states, transitions, entryPoints };
}

module.exports = { extractBehaviorGraph };
