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
// Keywords (not indentation) delimit structure. Newlines mark statement/block boundaries.
//
// State types:
// - setup_state: setup_stmt+ (no interact)
//   Actions: set, run, apply, remove, if, transition
// - oriented_state: goal? guide? teach* interact intent+ offtopic
//   Pre-interact: goal/guide/teach orient LLM context
//   Post-interact: intent handlers route LLM reply, offtopic fallback
//
// Blocks:
// - handler_block: repeat1(stmt) — inside intent/offtopic/failure/success
//   No trailing newlines; keywords mark boundaries
// - statement: stmt $._newline — used in trigger_decl (top-level)
//   Each statement requires trailing newline
//
// "on" forms:
// - on event "..." block    → top-level trigger
// - on intent "..." (inline | block)  → state handler (inline: transition; block: statements)
// - on offtopic (inline | block)      → state handler
// - on failure block        → error handler (for run/apply/remove)
// - on success block        → success handler (for parallel only, optional)

module.exports = grammar({
  name: 'behavior',

  extras: $ => [
    /[ \t]/,
    $.comment,
  ],

  word: $ => $.identifier,

  rules: {

    // ----------------------------------------------------------------
    // Top-level
    // ----------------------------------------------------------------

    behavior_file: $ => seq(
      repeat($._newline),
      repeat($.merge_decl),
      repeat($.trigger_decl),
      repeat($.state_decl),
    ),

    _newline: $ => /\r?\n/,
    _blank_line: $ => /[ \t]*\r?\n/,
    _end_stmt: $ => prec.right(seq($._newline, repeat($._blank_line))),

    // merge "file.behavior" — preamble only, enforced by runtime
    // Note: trailing _newline is handled by the $._newline alternative in flow_file
    merge_decl: $ => seq(
      'merge',
      '"',
      field('path', $.filename),
      '"',
      $._end_stmt,
    ),

    // on event "name" block
    trigger_decl: $ => seq(
      'on', 'event',
      '"', field('event', $.quoted_string), '"',
      $._newline,
      field('block', $.block),
      repeat($._blank_line),
    ),

    // state name body
    state_decl: $ => seq(
      'state',
      field('name', $.state_name),
      $._newline,
      field('body', $.state_body),
      repeat($._blank_line),
    ),

    // ================================================================
    // STATE BODY
    // ================================================================
    // Can be: setup-only, or setup + oriented, or just oriented
    // Keywords (goal, guide, teach, interact, on intent, on offtopic) mark transition

    state_body: $ => choice(
       // Only oriented: goal/guide/teach/interact/handlers
      $.oriented_state_body,
      // Setup statements followed by optional oriented
      prec.right(seq(
        repeat1($.block),
        optional($.oriented_state_body),
      )),
    ),

    // ================================================================
    // ORIENTED STATE (with interact + handlers)
    // ================================================================
    // goal? guide? teach* interact handler+
    // Order is strict: goal and guide orient LLM context, teach fills cache,
    // interact releases LLM for response, handlers route the reply.
    // FSM is guaranteed: repeat1(handler) ensures no deadlock.

    oriented_state_body: $ => prec.right(seq(
      seq($.goal_stmt, $._end_stmt),
      optional(seq($.guide_stmt, $._end_stmt)),
      repeat(seq($.teach_stmt, $._end_stmt)),
      seq($.interact_stmt, $._end_stmt),
      repeat1($.intent_handler),
      $.offtopic_handler,
    )),


    // ----------------------------------------------------------------
    // Block
    //
    // Contains a sequence of statements. Simple statements terminate
    // themselves with $._newline compound statements
    // ----------------------------------------------------------------

    // ================================================================
    // BLOCKS & STATEMENTS
    // ================================================================
    // block: used in trigger_decl (top-level), statements need newlines
    // handler_block: used in handlers/if/parallel, no trailing newlines

    block: $ => prec.right(repeat1(
      seq($.statement, optional($._end_stmt)),
    )),

    statement: $ => choice(
      $.memory_stmt,
      $.run_stmt,
      $.apply_stmt,
      $.remove_stmt,
      $.conditional_stmt,
      $.transition_stmt,
      $.temporal_stmt,
      $.parallel_stmt,
    ),

    handler_block: $ => prec.right(repeat1(choice(
      $.memory_stmt,
      $.run_stmt,
      $.apply_stmt,
      $.remove_stmt,
      $.conditional_stmt,
      $.transition_stmt,
    ))),

    // ----------------------------------------------------------------
    // Memory
    // ----------------------------------------------------------------

    // set context.var = expr
    // set session.count += 1
    // set localVar = "value"
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

    //TODO: Revise domains
    memory_domain: $ => choice('context', 'session', 'worksession', 'user'),

    // ----------------------------------------------------------------
    // Run
    // ----------------------------------------------------------------

    // Normal: run script|subagent|tool "target" "parameters"
    // NOTE: Batch was removed until it proves necessary
    // Batch: run subagent "target" each context.files [experimental]
    run_stmt: $ => prec.right(seq(
      'run',
      field('type', $.run_type),
      '"', field('target', $.quoted_string), '"',
      optional(seq(
        '"', field('parameters', $.quoted_string), '"',
      )),
      optional($.failure_stmt),
    )),

    run_type: $ => choice('script', 'subagent', 'tool'),

    // ----------------------------------------------------------------
    // Interaction
    // ----------------------------------------------------------------

    goal_stmt: $ => seq('goal', '"', field('text', $.quoted_string), '"'),

    guide_stmt: $ => seq('guide', '"', field('text', $.quoted_string), '"'),
    teach_stmt: $ => seq('teach', '"', field('text', $.filename), '"'),

    interact_stmt: $ => 'interact',

    // ----------------------------------------------------------------
    // UI manipulation
    // ----------------------------------------------------------------

    apply_stmt: $ => prec.right(seq(
      'apply', 'css',
      '"', field('text', $.quoted_string), '"',
      optional($.failure_stmt),
    )),

    remove_stmt: $ => prec.right(seq(
      'remove', 'css',
      '"', field('text', $.quoted_string), '"',
      optional($.failure_stmt),
    )),


    // ================================================================
    // HANDLERS (inside oriented states)
    // ================================================================
    // These are the routing statements after interact.
    // on intent | on offtopic
    // Inside handlers: NO goal, guide, teach, interact. Just actions.

    // on intent "text" (transition to state | block)
    intent_handler: $ => seq(
      'on', 'intent',
      '"', field('intent', $.quoted_string), '"',
      choice(
        prec(2, $.transition_stmt),
        prec(1, seq($._newline, field('block', $.block))),
      ),
    ),

    // on offtopic (transition to state | block)
    offtopic_handler: $ => seq(
      'on', 'offtopic',
      choice(
        prec(2, $.transition_stmt),
        prec(1, seq($._newline, field('block', $.block))),
      ),
    ),

    // on failure block
    failure_stmt: $ => seq(
      'on', 'failure',
      $._newline,
      field('block', $.block),
    ),

    // on success block (used in parallel only)
    success_stmt: $ => seq(
      'on', 'success',
      $._newline,
      field('block', $.block),
    ),


    // ================================================================
    // CONTROL FLOW (used in top-level trigger_decl only)
    // ================================================================

    // transition to state_name
    transition_stmt: $ => seq(
      'transition', 'to',
      field('state', $.state_name),
      $._newline
    ),

    // ================================================================
    // TEMPORAL & PARALLEL (generic versions for top-level)
    // ================================================================
    // These are only used in top-level on event handlers (trigger_decl),
    // which use the generic $.block. Inside states, use restricted variants.

    // if condition block [else block] endif
    conditional_stmt: $ => prec.right(seq(
      'if',
      field('condition', $.condition),
      $._newline,
      field('then', $.block),
      optional(seq(
        'else',
        $._newline,
        field('else', $.block),
      )),
      'end',
    )),

    // after N prompts block
    temporal_stmt: $ => seq(
      'after',
      field('count', $.number),
      'prompts',
      field('block', $.handler_block),
    ),

    // parallel block
    // on success is optional; on failure is required
    parallel_stmt: $ => seq(
      'parallel',
      field('block', $.handler_block),
      optional($.success_stmt),
      $.failure_stmt,
    ),

    // ----------------------------------------------------------------
    // Conditions and Expressions
    // ----------------------------------------------------------------

    // condition: one or more expressions joined by and|or
    condition: $ => prec.left(1, seq(
      $.expression,
      repeat(seq($.logical_op, $.expression)),
    )),

    logical_op: $ => choice('and', 'or'),

    // expression: simple value, or comparison
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

    // Dotted path as a single token: name, name_underscore, dotted.path.ref
    // Covers: state refs (phases.planning.start), scoped vars (context.files).
    // Defined as a direct regex (not seq(identifier, repeat(...))) so the node span
    // is the matched text only — the seq form made state_name absorb the leading
    // space after the keyword (e.g. `state foo` yielded " foo").
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

    // Identifiers in .behavior: same as .description (no dots — handled via path rule)
    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_-]*/,

    comment: $ => token(seq('//', /.*/)),
  },
});