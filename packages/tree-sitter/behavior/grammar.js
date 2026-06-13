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
// State structure (v2: rigid types):
// - oriented_state_body: goal? → guide? → teach* → interact → handler+
// LLM-active state: goal/guide orient context, teach fills cache
// - setup_state_body: repeat1(setup_action_stmt)
// Pure setup: run/set/transition without interact
// - Handlers (on intent/offtopic) = switch cases: no goal/guide/teach/interact
//
// Statement termination:
// Simple statements end with optional($._newline).
// Compound statements (those containing a block) end with their
// block's $._dedent — no trailing newline needed.
//
// "on" disambiguation:
// on event "..." → trigger_decl (top-level, uses $.block)
// on intent "..." → intent_trigger (inside state, uses $.block)
// on offtopic → offtopic_stmt (inside state, uses $.block)
// on failure → failure_stmt (inside state, uses $.block)
// on success → parallel_trigger (inside handler, uses $.block)

module.exports = grammar({
  name: 'behavior',

  extras: $ => [
    /[ \t]/,
    $.comment,
  ],

  word: $ => $.identifier,
  
  conflicts: $ => [
    [$.apply_stmt],
    [$.remove_stmt],
    [$.run_stmt],
  ],

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
    _blank_line: $ => seq(
      $._newline,
      repeat1(seq(/[ \t]*/, $._newline))
    ),

    // merge "file.behavior" — preamble only, enforced by runtime
    // Note: trailing _newline is handled by the $._newline alternative in flow_file
    merge_decl: $ => seq(
      'merge',
      '"',
      field('path', $.filename),
      '"',
      $._newline,
    ),

    // on event "name" block
    trigger_decl: $ => seq(
      'on', 'event',
      '"', field('event', $.quoted_string), '"',
      $._newline,
      field('block', $.block),
    ),

    // state name body
    state_decl: $ => seq(
      'state',
      field('name', $.state_name_string),
      $._newline,
      field('body', choice(
        seq($.block, optional($.oriented_state_body)),
        $.oriented_state_body,
      )),
      $._newline,
    ),

    // ================================================================
    // ORIENTED STATE (with interact + handlers)
    // ================================================================
    // goal? guide? teach* interact handler+
    // Order is strict: goal and guide orient LLM context, teach fills cache,
    // interact releases LLM for response, handlers route the reply.
    // FSM is guaranteed: repeat1(handler) ensures no deadlock.

    oriented_state_body: $ => seq(
      optional($.goal_stmt),
      optional($.guide_stmt),
      repeat($.teach_stmt),
      $.interact_stmt,
      choice(
        seq(repeat1($.intent_trigger), $.offtopic_stmt),
        $.offtopic_stmt,
      ),
    ),


    // ----------------------------------------------------------------
    // Block
    //
    // Contains a sequence of statements. Simple statements terminate
    // themselves with $._newline compound statements
    // ----------------------------------------------------------------

    block: $ => prec.right($.statement),
    // testing if it'll be needed:
    // $.guide_stmt,
    // $.teach_stmt,
    // $.goal_stmt,
    // $.interact_stmt,
    // $.intent_trigger,
    // $.offtopic_stmt,

    statement: $ => seq(
        choice(
        $.memory_stmt,
        $.run_stmt,
        $.apply_stmt,
        $.remove_stmt,
        $.conditional_stmt,
        $.transition_stmt,
        $.temporal_stmt,
        $.parallel_stmt,
      ),
      $._newline,
    ),

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
    run_stmt: $ => seq(
      'run',
      field('run_type', $.run_type),
      '"',
      field('target', $.quoted_string),
      '"',
      optional(seq(
        '"',
        field('parameters', $.quoted_string),
        '"',
      )),
      optional($.failure_stmt),
    ),

    run_type: $ => choice('script', 'subagent', 'tool'),

    // ----------------------------------------------------------------
    // Interaction
    // ----------------------------------------------------------------

    goal_stmt: $ => seq('goal', '"', field('text', $.quoted_string), '"', $._newline),

    guide_stmt: $ => seq('guide', '"', field('text', $.filename), '"', $._newline),
    teach_stmt: $ => seq('teach', '"', field('text', $.filename), '"', $._newline),

    interact_stmt: $ => seq(
      'interact',
      $._newline,
    ),

    // ----------------------------------------------------------------
    // UI manipulation
    // ----------------------------------------------------------------

    apply_stmt: $ => seq(
      'apply',
      'css',
      field('text', $.with_quotes_string),
      optional($.failure_stmt),
    ),

    remove_stmt: $ => seq(
      'remove',
      'css',
      field('text', $.with_quotes_string),
      optional($.failure_stmt),
    ),

    // TODO: maybe expand to html, video, etc.
    // for future genUI capabilities, but for now just CSS selectors for dynamic UI updates.
    // ui_target: $ => choice('css', 'html', 'video'),

    // ================================================================
    // HANDLERS (inside oriented states)
    // ================================================================
    // These are the routing statements after interact.
    // on intent | on offtopic
    // Inside handlers: NO goal, guide, teach, interact. Just actions.

    // on intent "text" (transition to state | block)
    intent_trigger: $ => seq(
      'on', 'intent',
      '"',
      field('intent', $.quoted_string),
      '"',
      $._newline,
      field('block', $.block),
    ),

    offtopic_stmt: $ => seq(
      'on', 'offtopic',
      $._newline,
      field('block', $.block),
    ),

    failure_stmt: $ => seq(
      'on', 'failure', $._newline,
      field('on_failure', $.block),
    ),
    sucess_stmt: $ => seq(
      'on', 'success', $._newline,
      field('on_success', $.block),
    ),


    // ================================================================
    // CONTROL FLOW (used in top-level trigger_decl only)
    // ================================================================

    // transition to state_name
    transition_stmt: $ => seq(
      'transition', 'to',
      field('state', $.state_name_string),
    ),

    // ================================================================
    // TEMPORAL & PARALLEL (generic versions for top-level)
    // ================================================================
    // These are only used in top-level on event handlers (trigger_decl),
    // which use the generic $.block. Inside states, use restricted variants.

    // if condition block [else block]
    // Used only in trigger_decl (top-level events)
    conditional_stmt: $ => seq(
      'if',
      field('condition', $.condition),
      $._newline,
      field('then', $.block),
      optional(seq(
        $._newline,
        'else',
        $._newline,
        field('else', $.block)
      )),
      
      $._blank_line,
    ),

    // after N prompts block
    // Used only in trigger_decl
    temporal_stmt: $ => seq(
      'after',
      field('count', $.number_literal),
      'prompts',
      field('block', $.block),
      $._blank_line,
    ),

    // parallel block
    // Used only in trigger_decl
    parallel_stmt: $ => seq(
      'parallel',
      $._newline,
      field('block', $.block),
      $.sucess_stmt,
      $.failure_stmt,
      $._blank_line,
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
      $.number_literal,
      $.boolean_literal,
      $.null_literal,
      $.state_name_string, // identifiers and dotted refs: session.count, context.files
    ),

    // ----------------------------------------------------------------
    // Shared structures
    // ----------------------------------------------------------------

    // Dotted path: identifier(.identifier)*
    // Covers: state refs (phases.planning.start), scoped vars (context.files)
    state_name_string: $ => seq($.identifier, repeat(seq('.', $.identifier))),


    // ----------------------------------------------------------------
    // Primitives
    // ----------------------------------------------------------------

    with_quotes_string: $ => /"[^"\\]*(?:\\.[^"\\]*)*"/,
    number_literal: $ => token(/-?[0-9]+(\.[0-9]+)?/),
    boolean_literal: $ => choice('true', 'false'),
    null_literal: $ => 'null',
    // Matches filenames with one or more dots: doctor.behavior, health.example.com
    filename: $ => /[^"\n]+/,
    quoted_string: $ => /[^"\\]*(?:\\.[^"\\]*)*/,

    // Identifiers in .behavior: same as .description (no dots — handled via path rule)
    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_-]*/,

    comment: $ => token(seq('//', /.*/)),
  },
});