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
// Indentation (INDENT / DEDENT / NEWLINE) is handled by the external
// scanner in src/scanner.c — same algorithm as the agent grammar.
//
// Statement termination:
//   Simple statements end with optional($._newline).
//   Compound statements (those containing a $.block) end with their
//   block's $._dedent — no trailing newline needed.
//   This lets repeat1($.statement) inside $.block work without an
//   explicit separator, even when simple and compound statements mix.
//
// "on" disambiguation:
//   on event "..."   → trigger_decl  (top-level)
//   on intent "..."  → intent_trigger (inside block)
//   on offtopic      → offtopic_stmt  (inside block)
//   on fallback      → fallback_stmt (inside block)
//   on complete      → parallel_trigger (inside block)
//   on failed        → parallel_trigger (inside block)

module.exports = grammar({
  name: 'behavior',

  externals: $ => [
    $._newline,   // \n where next line has SAME indentation level
    $._indent,    // \n where next line has MORE indentation (block opens)
    $._dedent,    // \n where next line has LESS indentation (block closes)
  ],

  extras: $ => [
    /[ \t]/,
    $.comment,
  ],

  word: $ => $.identifier,

  rules: {

    // ----------------------------------------------------------------
    // Top-level
    // ----------------------------------------------------------------

    behavior_file: $ => repeat1(choice(
      $._newline,      // blank lines between top-level declarations
      $.merge_decl,
      $.trigger_decl,
      $.state_decl,
    )),

    // merge "file.behavior"   — preamble only, enforced by runtime
    // Note: trailing _newline is handled by the $._newline alternative in flow_file
    merge_decl: $ => seq(
      'merge',
      field('path', $.quoted_string),
    ),

    // on event "name" block
    trigger_decl: $ => seq(
      'on', 'event',
      field('event', $.quoted_string),
      $.block,
    ),

    // state name block
    state_decl: $ => seq(
      'state',
      field('name', $.path),
      $.block,
    ),

    // ----------------------------------------------------------------
    // Block
    //
    // Contains a sequence of statements. Simple statements terminate
    // themselves with optional($._newline); compound statements end
    // with their nested block's $._dedent. No separator between stmts.
    // ----------------------------------------------------------------

    block: $ => seq(
      $._indent,
      repeat1($.statement),
      $._dedent,
    ),

    statement: $ => choice(
      $.memory_stmt,
      $.run_stmt,
      $.guide_stmt,
      $.teach_stmt,
      $.goal_stmt,
      $.interact_stmt,
      $.apply_stmt,
      $.remove_stmt,
      $.conditional_stmt,
      $.transition_stmt,
      $.intent_trigger,
      $.offtopic_stmt,
      $.fallback_stmt,
      $.temporal_stmt,
      $.parallel_stmt,
      $.parallel_trigger,
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
      optional($._newline),
    ),

    assignment_op: $ => choice('=', '+=', '-='),

    memory_target: $ => choice(
      seq(field('domain', $.memory_domain), '.', field('var', $.identifier)),
      field('var', $.identifier),
    ),

    memory_domain: $ => choice('context', 'session', 'worksession', 'user'),

    // ----------------------------------------------------------------
    // Run
    // ----------------------------------------------------------------

    // Normal: run script|subagent|tool "target" ["label"] [silent|in background]
    // Batch:  run subagent "target" each context.files  [experimental]
    run_stmt: $ => seq(
      'run',
      field('run_type', $.run_type),
      field('target', $.quoted_string),
      optional(field('label', $.quoted_string)),
      choice(
        seq('each', field('collection', $.path)), // batch form [experimental]
        repeat($.run_modifier),                   // normal form (zero or more)
      ),
      optional($._newline),
    ),

    run_type: $ => choice('script', 'subagent', 'tool'),

    run_modifier: $ => choice(
      'silent',
      seq('in', 'background'),
    ),

    // ----------------------------------------------------------------
    // Interaction
    // ----------------------------------------------------------------

    guide_stmt: $ => seq('guide', field('text', $.quoted_string), optional($._newline)),
    teach_stmt: $ => seq('teach', field('text', $.quoted_string), optional($._newline)),
    goal_stmt:  $ => seq('goal',  field('text', $.quoted_string), optional($._newline)),

    interact_stmt: $ => seq(
      'interact',
      optional($._newline),
    ),

    // ----------------------------------------------------------------
    // UI manipulation
    // ----------------------------------------------------------------

    apply_stmt: $ => seq(
      'apply',
      field('target', $.ui_target),
      field('text', $.quoted_string),
      optional($._newline),
    ),

    remove_stmt: $ => seq(
      'remove',
      field('target', $.ui_target),
      field('text', $.quoted_string),
      optional($._newline),
    ),

    ui_target: $ => choice('css', 'html', 'video'),

    // ----------------------------------------------------------------
    // Control flow
    // ----------------------------------------------------------------

    // if condition block [else block]
    conditional_stmt: $ => seq(
      'if',
      field('condition', $.condition),
      field('then', $.block),
      optional(seq('else', field('else', $.block))),
    ),

    // transition to state_name
    transition_stmt: $ => seq(
      'transition', 'to',
      field('state', $.path),
      optional($._newline),
    ),

    // on intent "text" (transition to state | block)
    intent_trigger: $ => seq(
      'on', 'intent',
      field('intent', $.quoted_string),
      choice(
        seq('transition', 'to', field('state', $.path), optional($._newline)), // inline
        field('block', $.block),                                                // block form
      ),
    ),

    offtopic_stmt: $ => seq('on', 'offtopic', field('block', $.block)),
    fallback_stmt: $ => seq('on', 'fallback', field('block', $.block)),

    // ----------------------------------------------------------------
    // Temporal [experimental]
    // ----------------------------------------------------------------

    temporal_stmt: $ => seq(
      'after',
      field('count', $.number_literal),
      'prompts',
      field('block', $.block),
    ),

    // ----------------------------------------------------------------
    // Parallel [experimental]
    // ----------------------------------------------------------------

    parallel_stmt: $ => seq(
      'parallel',
      field('block', $.block),
    ),

    // on complete block | on failed block
    // Appears after parallel_stmt at the same indentation level
    parallel_trigger: $ => seq(
      'on',
      field('event', choice('complete', 'failed')),
      field('block', $.block),
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
      $.quoted_string,
      $.number_literal,
      $.boolean_literal,
      $.null_literal,
      $.path,       // identifiers and dotted refs: session.count, context.files
    ),

    // ----------------------------------------------------------------
    // Shared structures
    // ----------------------------------------------------------------

    // Dotted path: identifier(.identifier)*
    // Covers: state refs (phases.planning.start), scoped vars (context.files)
    path: $ => seq($.identifier, repeat(seq('.', $.identifier))),

    // ----------------------------------------------------------------
    // Primitives
    // ----------------------------------------------------------------

    quoted_string:   $ => /"[^"\\]*(?:\\.[^"\\]*)*"/,
    number_literal:  $ => token(/-?[0-9]+(\.[0-9]+)?/),
    boolean_literal: $ => choice('true', 'false'),
    null_literal:    $ => 'null',

    // Identifiers in .behavior: same as .description (no dots — handled via path rule)
    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_-]*/,

    comment: $ => token(seq('//', /.*/)),
  },
});
