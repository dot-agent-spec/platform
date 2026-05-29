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

const AGENT_DOCS = {
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

const FLOW_DOCS = {
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

    const docs = langId === 'agent' ? AGENT_DOCS : FLOW_DOCS;
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
