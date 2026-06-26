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

// behavior/grammar.js — Tree-sitter grammar for the .behavior DSL
//
// DESIGN (v0.1, DA01-01): keyword-driven, not newline-driven.
//   - Whitespace (including newlines) is insignificant — it lives in `extras`.
//     Structure is held by reserved keywords and an explicit `end` terminator.
//   - A multi-statement block closes with `end` whenever it could be followed by
//     a sibling statement of the same kind: `if`, `on failure` (block form),
//     `on intent`/`on offtopic` (block form), `after`, `parallel`.
//   - A handler of a SINGLE action stays inline with NO `end`
//     (e.g. `on failure transition to error`, `on intent "x" transition to y`).
//   - `on success` does NOT exist. Success is the implicit sequential fall-through.
//   - `run` inside `parallel` carries NO own failure handler — the group does.
//
// The grammar is deliberately PERMISSIVE. Ordering, block uniqueness, the
// oriented-state shape (goal<guide<teach<interact), the FSM at-least-one-exit
// guarantee, and the native-states allowlist are all enforced by the LINTER,
// not here. `state_body` is therefore a flat `repeat(statement)`.

module.exports = grammar({
  name: 'behavior',

  // Newlines are insignificant: keywords + `end` delimit structure.
  extras: $ => [
    /\s/,       // any whitespace, including newlines
    $.comment,  // // line comments (stop at newline; the newline is extra)
  ],

  word: $ => $.identifier,

  // After a run/apply/remove core, a following `on` may extend the statement
  // (its `on failure` handler) or begin a sibling `on intent`/`on offtopic`
  // handler. The two diverge only at the SECOND token (`failure` vs
  // `intent`/`offtopic`), so we defer to GLR to explore both readings.
  conflicts: $ => [
    [$.run_stmt],
    [$.apply_stmt],
    [$.remove_stmt],
    // A handler body is either a single inline action or a block closed by
    // `end`. After the first action the two readings diverge on whether `end`
    // follows; GLR keeps both and the one that parses to completion wins.
    [$.block, $.failure_stmt],
    [$.block, $.intent_handler],
    [$.block, $.offtopic_handler],
  ],

  rules: {

    // ----------------------------------------------------------------
    // Top-level
    // ----------------------------------------------------------------
    // merge preambles, global event triggers, and state declarations, in any
    // order. The linter enforces that `merge` is a preamble.

    behavior_file: $ => repeat(choice(
      $.merge_decl,
      $.trigger_decl,
      $.state_decl,
    )),

    // merge "file.behavior"
    merge_decl: $ => seq(
      'merge',
      '"', field('path', $.filename), '"',
    ),

    // on event "name" <block>
    // The trigger block self-delimits: it contains only actions, and the next
    // top-level keyword (`on`, `state`, `merge`) cannot start an action.
    trigger_decl: $ => seq(
      'on', 'event',
      '"', field('event', $.quoted_string), '"',
      field('block', $.block),
    ),

    // state name <body>
    state_decl: $ => seq(
      'state',
      field('name', $.state_name),
      field('body', $.state_body),
    ),

    // ================================================================
    // STATE BODY
    // ================================================================
    // Flat and permissive: orientation (goal/guide/teach/interact), handlers
    // (on intent / on offtopic), and actions, in any order. The linter validates
    // the legal shape per state type (setup vs oriented).

    state_body: $ => prec.right(repeat1(choice(
      $.goal_stmt,
      $.guide_stmt,
      $.teach_stmt,
      $.interact_stmt,
      $.intent_handler,
      $.offtopic_handler,
      $._action,
    ))),

    // ================================================================
    // BLOCKS
    // ================================================================
    // A block is a run of ACTIONS only — no orientation, no `on intent/offtopic`.
    // That keyword-disjointness is what lets blocks delimit cleanly. Multi-
    // statement blocks are always closed by `end` (or `else`) at their use site.

    block: $ => repeat1($._action),

    _action: $ => choice(
      $.memory_stmt,
      $.run_stmt,
      $.apply_stmt,
      $.remove_stmt,
      $.conditional_stmt,
      $.transition_stmt,
      $.after_stmt,
      $.parallel_stmt,
    ),

    // ----------------------------------------------------------------
    // Memory:  set context.var = expr | set localVar += 1
    // ----------------------------------------------------------------

    memory_stmt: $ => seq(
      'set',
      field('target', $.memory_target),
      field('op', $.assignment_op),
      field('value', $.expression),
    ),

    assignment_op: $ => choice('=', '+=', '-='),

    memory_target: $ => choice(
      seq(field('domain', $.memory_domain), '.', field('var', $.identifier)),
      field('var', $.identifier),
    ),

    memory_domain: $ => choice('context', 'session', 'worksession', 'user'),

    // ----------------------------------------------------------------
    // Run:  run script|subagent|tool "target" ["parameters"] [on failure ...]
    // ----------------------------------------------------------------

    run_stmt: $ => seq(
      'run',
      field('type', $.run_type),
      '"', field('target', $.quoted_string), '"',
      optional(seq('"', field('parameters', $.quoted_string), '"')),
      optional($.failure_stmt),
    ),

    run_type: $ => choice('script', 'subagent', 'tool'),

    // ----------------------------------------------------------------
    // UI manipulation:  apply|remove css "..." [on failure ...]
    // ----------------------------------------------------------------

    apply_stmt: $ => seq(
      'apply', 'css',
      '"', field('text', $.quoted_string), '"',
      optional($.failure_stmt),
    ),

    remove_stmt: $ => seq(
      'remove', 'css',
      '"', field('text', $.quoted_string), '"',
      optional($.failure_stmt),
    ),

    // ----------------------------------------------------------------
    // Error handling:  catch-and-resume (semantics live in the runtime/linter)
    //
    //   on failure transition to error          ← inline, single action
    //   on failure run script "cleanup.sh"      ← inline, any single action
    //   on failure <actions> end                ← block form
    //
    // No `on success` — success is the implicit fall-through to the next stmt.
    // Any restriction on which actions are valid here is the parser/linter's job.
    // ----------------------------------------------------------------

    failure_stmt: $ => seq('on', 'failure', handlerBody($)),

    // ----------------------------------------------------------------
    // Interaction (orientation)
    // ----------------------------------------------------------------

    goal_stmt: $ => seq('goal', '"', field('text', $.quoted_string), '"'),
    guide_stmt: $ => seq('guide', '"', field('text', $.quoted_string), '"'),
    teach_stmt: $ => seq('teach', '"', field('text', $.filename), '"'),
    interact_stmt: $ => 'interact',

    // ----------------------------------------------------------------
    // Handlers (post-interact routing)
    //
    //   on intent "text" transition to state    ← inline, single action
    //   on intent "text" <actions> end          ← block form
    //   on offtopic transition to state         ← inline, single action
    //   on offtopic <actions> end               ← block form
    // ----------------------------------------------------------------

    intent_handler: $ => seq(
      'on', 'intent',
      '"', field('intent', $.quoted_string), '"',
      handlerBody($),
    ),

    offtopic_handler: $ => seq(
      'on', 'offtopic',
      handlerBody($),
    ),

    // ----------------------------------------------------------------
    // Control flow
    // ----------------------------------------------------------------

    // transition to state_name
    transition_stmt: $ => seq(
      'transition', 'to',
      field('state', $.state_name),
    ),

    // if condition <then> [else <else>] end
    conditional_stmt: $ => seq(
      'if',
      field('condition', $.condition),
      field('then', $.block),
      optional(seq('else', field('else', $.block))),
      'end',
    ),

    // after N prompts <block> end
    after_stmt: $ => seq(
      'after',
      field('count', $.number),
      'prompts',
      field('block', $.block),
      'end',
    ),

    // parallel <runs> [on failure <block>] end
    // Runs inside parallel are failure-less (aliased to run_stmt for the AST):
    // the group's `on failure` handles failure. The failure block is delimited
    // by the parallel's single `end` (not its own) — no double `end`. No
    // `on success`: success falls through after `end`.
    parallel_stmt: $ => seq(
      'parallel',
      repeat1(alias($._parallel_run, $.run_stmt)),
      optional(seq('on', 'failure', field('on_failure', $.block))),
      'end',
    ),

    _parallel_run: $ => seq(
      'run',
      field('type', $.run_type),
      '"', field('target', $.quoted_string), '"',
      optional(seq('"', field('parameters', $.quoted_string), '"')),
    ),

    // ----------------------------------------------------------------
    // Conditions and expressions
    // ----------------------------------------------------------------

    condition: $ => prec.left(1, seq(
      $.expression,
      repeat(seq($.logical_op, $.expression)),
    )),

    logical_op: $ => choice('and', 'or'),

    expression: $ => choice(
      prec(1, seq(field('left', $.value), field('op', $.comparison_op), field('right', $.value))),
      $.value,
    ),

    comparison_op: $ => choice('==', '!=', '>', '<', '>=', '<='),

    value: $ => choice(
      $.with_quotes_string,
      $.number,
      $.boolean,
      $.null,
      $.state_name, // identifiers and dotted refs: session.count, context.files
    ),

    // ----------------------------------------------------------------
    // Shared structures
    // ----------------------------------------------------------------

    // Dotted path as a single token: name, name_underscore, dotted.path.ref.
    // Direct regex (not seq) so the node span is the matched text only.
    state_name: $ => /[a-zA-Z_][a-zA-Z0-9_-]*(\.[a-zA-Z_][a-zA-Z0-9_-]*)*/,

    // ----------------------------------------------------------------
    // Primitives
    // ----------------------------------------------------------------

    with_quotes_string: $ => /"[^"\\]*(?:\\.[^"\\]*)*"/,

    number: $ => token(/-?[0-9]+(\.[0-9]+)?/),

    boolean: $ => choice('true', 'false'),

    null: $ => 'null',

    quoted_string: $ => /[^"\\]*(?:\\.[^"\\]*)*/,

    // Matches filenames with one or more dots: doctor.behavior, health.example.com
    filename: $ => /[^"\n]+/,

    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_-]*/,

    comment: $ => token(seq('//', /.*/)),
  },
});

// Shared body for `on failure` / `on intent` / `on offtopic`:
//   - a single inline action (no `end`), or
//   - a block of actions closed by `end`.
// The two readings diverge on whether `end` appears, so GLR resolves them
// (see the `conflicts` declaration).
function handlerBody($) {
  return choice(
    // Prefer the inline single-action reading whenever it yields a complete
    // parse; fall back to the block form (which requires `end`) only when
    // inline cannot. prec.dynamic resolves this at GLR runtime — unlike a
    // static prec, it keeps the block parse reachable.
    prec.dynamic(1, $._action),
    seq(field('block', $.block), 'end'),
  );
}
