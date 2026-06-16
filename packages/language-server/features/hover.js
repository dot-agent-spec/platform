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

const { MarkupKind } = require('vscode-languageserver');

const DESCRIPTION_DOCS = {
    'agent':        '**`agent name`**\n\nDeclares a new agent. The central node of the manifest.',
    'domain':       '**`domain url`**\n\nDeclares the canonical domain for this agent, establishing cryptographic identity and ownership.',
    'license':      '**`license type`**\n\nDeclares the license under which this agent is distributed (e.g., MIT, Copyright).',
    'terms':        '**`terms url`**\n\nLink to the terms of service.',
    'privacy':      '**`privacy url`**\n\nLink to the privacy policy.',
    'description':  '**`description`**\n\nA brief description of the agent, used by the Runtime for semantic indexing.',
    'behavior':     '**`behavior file.behavior`**\n\nThe `.behavior` file that manages the state and transitions of this agent.',
    'requires':     '**`requires Type`**\n\nTypes (native or custom) that the Runtime must ensure exist in context before triggering the `.behavior`.',
    'input':        '**`input Type`**\n\nThe input data types expected for this agent to operate.',
    'capabilities': '**`capabilities Action`**\n\nThe Actions or capabilities this agent can execute. Also acts as a Sandboxing Contract.',
    'output':       '**`output Type`**\n\nThe data type this agent returns.',
    'type':         '**`type name`**\n\nDeclares a custom type to anchor custom typing to Wikidata or Schema.org.',
    'concept':      '**`concept url`**\n\nThe Wikidata or Schema.org concept URL this type maps to.',
};

const BEHAVIOR_DOCS = {
    'merge':       '**`merge "file.behavior"`**\n\nIncludes another `.behavior` file. Must appear before any `state` or `on event` declarations (preamble-only, eager loading).',
    'state':       '**`state name`**\n\nDeclares a named state. States contain the logic that runs while the agent is in that state.',
    'on':          '**`on event|intent|offtopic|failure|success`**\n\nBinds a handler to a trigger. Top-level: `on event`. Inside a state: `on intent`, `on offtopic`. After `run`/`apply`/`remove`: `on failure`. Inside `parallel`: `on success` (optional), `on failure` (required).',
    'run':         '**`run script|subagent|tool "target" ["parameters"]`**\n\nExecutes a script, subagent, or tool. Optionally followed by `on failure` to handle errors.',
    'guide':       '**`guide "text"`**\n\nInjects a system-level instruction into the conversation context, shaping the agent\'s persona or approach without being visible as a reply.',
    'teach':       '**`teach "file"`**\n\nLoads a file into the agent\'s working knowledge for the duration of this state.',
    'goal':        '**`goal "text"`**\n\nSets the agent\'s objective for this state, used by the runtime for planning and alignment checks.',
    'interact':    '**`interact`**\n\nPauses execution and waits for user input.',
    'set':         '**`set domain.var = value`**\n\nAssigns a value to a memory variable. Domains: `context`, `session`, `worksession`, `user`.',
    'context':     '**`context`** memory domain — scoped to the current agent run.',
    'session':     '**`session`** memory domain — persists for the user\'s current session.',
    'worksession': '**`worksession`** memory domain — persists across a task-oriented work session (isolated per task).',
    'user':        '**`user`** memory domain — persists across sessions for a given user.',
    'transition':  '**`transition to state`**\n\nTransitions immediately to the named state.',
    'if':          '**`if condition`**\n\nConditional execution. Condition can use `==`, `!=`, `>`, `<`, `>=`, `<=`, `and`, `or`. Close the block with `end`.',
    'else':        '**`else`**\n\nAlternative branch of an `if` statement. Close the block with `end`.',
    'end':         '**`end`**\n\nCloses an `if`/`else` block.',
    'after':       '**`after N prompts`**\n\n[Experimental] Executes a block after N user prompts have occurred in this state.',
    'parallel':    '**`parallel`**\n\n[Experimental] Runs a block of `run` statements concurrently. Follow with optional `on success` and required `on failure` handlers.',
    'apply':       '**`apply css "selector"`**\n\nApplies a UI manipulation to a CSS selector. Optionally followed by `on failure`.',
    'remove':      '**`remove css "selector"`**\n\nRemoves a UI element by CSS selector. Optionally followed by `on failure`.',
    'failure':     '**`on failure`**\n\nError handler block executed when a `run`, `apply`, `remove`, or `parallel` statement fails.',
    'success':     '**`on success`**\n\nOptional success handler block inside a `parallel` statement.',
};

function provideHover(langId, text, position) {
    const lines = text.split('\n');
    const line = lines[position.line] || '';
    const ch = position.character;

    // Find word at cursor
    let start = ch, end = ch;
    while (start > 0 && /[a-zA-Z0-9_]/.test(line[start - 1])) start--;
    while (end < line.length && /[a-zA-Z0-9_]/.test(line[end])) end++;
    const word = line.slice(start, end);
    if (!word) return null;

    const docs = langId === 'description' ? DESCRIPTION_DOCS : BEHAVIOR_DOCS;
    const doc = docs[word];
    if (!doc) return null;

    return {
        contents: { kind: MarkupKind.Markdown, value: doc },
        range: {
            start: { line: position.line, character: start },
            end:   { line: position.line, character: end },
        },
    };
}

module.exports = { provideHover };
