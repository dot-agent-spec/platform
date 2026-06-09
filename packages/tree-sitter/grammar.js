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

// grammar.js — Tree-sitter grammar for the .agent DSL (.description / .type)
//
// Indentation (INDENT / DEDENT / NEWLINE) is handled by the external
// scanner in src/scanner.c — Tree-sitter has no native indent support.
//
// Structural decision:
//   - agent metadata (domain, license, terms, privacy) is indented under `agent`
//   - semantic blocks (description, behavior, requires, input, capabilities, output)
//     are top-level statements that implicitly belong to the preceding agent
//
// Sep-by pattern:
//   Blocks use  seq(item, repeat(seq($._newline, item)), $._dedent)
//   instead of  repeat1(seq(item, $._newline))
//   This is necessary because the scanner emits DEDENT (not NEWLINE) for the
//   \n that follows the last item — so items must NOT consume their own newline.


// Evolution to v1.0.0-release:
//   (in progress) - Indentation limits (_indent / _dedent) removed to optimize AI-generation stability.
//   - Structural focus shifted entirely to declarative keywords and explicit newlines.
//   - Strict separation of ontological routing: 'category' (Wikidata) vs 'concept' (Schema.org).

module.exports = grammar({
  name: 'dot-agent',

  // TODO: Remove indentation level, the language should focus on keywords. 
  // External tokens produced by src/scanner.c
  externals: $ => [
    $._newline,   // \n where next line has SAME indentation level
    $._indent,    // \n where next line has MORE indentation (block opens)
    $._dedent,    // \n where next line has LESS indentation (block closes)
  ],

  // Tokens silently skipped between grammar tokens
  extras: $ => [
    /[ \t]/,    // horizontal whitespace
    $.comment,  // // line comments
  ],

  // `identifier` is the "word" token — helps resolve keyword/identifier ambiguity
  word: $ => $.identifier,

  rules: {

    // ----------------------------------------------------------------
    // Top-level
    // ----------------------------------------------------------------

    manifest: $ => repeat1(choice($._newline, $.statement)),

    statement: $ => choice(
      $.agent_decl,
      $.type_decl,
    ),

    // ----------------------------------------------------------------
    // Agent Declaration
    //
    //   agent Doctor
    //     domain health.example.com
    //     license MIT
    //     terms  https://...
    //     privacy https://...
    // ----------------------------------------------------------------

    agent_decl: $ => seq(
      'agent',
      field('name', $.agent_name),
      $._newline,
      repeat1(seq($.agent_meta, $._newline)),
      optional(field('description', $.description_block)),
      optional(field('persona', $.persona_block)),
      optional(field('behavior', $.behavior_block)),
      optional(field('capabilities', $.capabilities_block)),
      optional(field('requires', $.requires_block)),
      optional(field('input', $.input_block)),
      optional(field('output', $.output_block)),
    ),

    // Supports single-word (Doctor) and multi-word (Mickey Mouse) names
    agent_name: $ => seq($.identifier, repeat($.identifier)),

    // agent_meta does NOT consume a trailing _newline.
    // The sep-by pattern in agent_decl handles newlines between items.
    agent_meta: $ => seq(
      field('key', $.agent_meta_key),
      field('value', choice($.url, $.bare_string)),
    ),

    agent_meta_key: $ => choice('domain', 'license', 'terms', 'privacy'),

    // ----------------------------------------------------------------
    // Semantic & Cognitive Capability Blocks
    // ----------------------------------------------------------------

    description_block: $ => seq(
      'description',
      $._newline,
      field('content', $.description_content),
      $._blank_line,
    ),
    description_content: $ => repeat1(
      seq($.text_content, $._newline),
    ),

    // Free-form text line — external tokens (_newline) already
    // take automatic priority over regular tokens; no prec(-1) needed.
    // Without it, same-prec ties are broken by match length, so text_content
    // (whole line) beats identifier (single word), fixing accented chars.
    text_content: $ => token(/[^\n\r]+/),

    _blank_line: $ => prec(2, $._newline),

    persona_block: $ => seq(
      'persona',
      field('file', $.bare_string),
      $._newline,
    ),

    behavior_block: $ => seq(
      'behavior',
      field('file', $.bare_string),
      $._newline,
    ),

    requires_block: $ => seq(
      'requires',
      choice(
        // Inline: requires Prontuario, UserProfile
        seq($.type_list, $._newline),
        // Multiline block
        seq(
          $.type_reference, repeat(seq($._newline, $.type_reference)),
        ),
      ),
    ),

    input_block: $ => seq(
      'input',
      choice(
        seq($.type_list, $._newline),
        seq(
          $.typed_item, repeat(seq($._newline, $.typed_item)),
        ),
      ),
    ),

    capabilities_block: $ => seq(
      'capabilities',
      choice(
        seq($.type_list, $._newline),
        seq(
          $.cap_item, repeat(seq($._newline, $.cap_item)),
        ),
      ),
    ),

    output_block: $ => seq(
      'output',
      choice(
        seq($.type_list, $._newline),
        seq(
          $.typed_item, repeat(seq($._newline, $.typed_item)),
        ),
      ),
    ),

    // ----------------------------------------------------------------
    // Type Declaration
    //
    //   type Prontuario
    //     concept https://...
    //     patient: Person "Paciente que será atendido"
    //     exames: [Exam]
    //     status: Enum(active, archived)
    //     imagem?: Avatar
    // ----------------------------------------------------------------

    type_decl: $ => seq(
      'type',
      field('name', $.identifier),
      $._indent,
      $.type_property, repeat(seq($._newline, $.type_property)),
      $._dedent,
    ),

    // type_property does NOT consume trailing _newline (sep-by in type_decl)
    type_property: $ => seq(
      $.category_prop,
      optional($.concept_prop),
      repeat1(
        $.property_decl,
      ),
    ),
    // TODO: Rever esses parenteses
    category_prop: $ => seq(
      'category',
      field('uri', $.url),
      optional(seq('(', field('label', $.bare_string), ')')),
    ),

    concept_prop: $ => seq(
      'concept',
      field('uri', $.url),
      optional(seq('(', field('label', $.bare_string), ')')),
    ),

    // name?: Type  "optional description"   (? before colon, TypeScript-style)
    property_decl: $ => seq(
      field('name', $.identifier),
      optional(field('optional_marker', $.optional_marker)),
      ':',
      field('type', $.type_value),
      optional(field('description', $.quoted_string)),
    ),

    optional_marker: $ => '?',

    // ----------------------------------------------------------------
    // Type Values  (grammar.md + extensions from review)
    // ----------------------------------------------------------------

    type_value: $ => choice(
      $.type_ref,                                     // Person | std.Prompt
      seq('[', $.type_ref, ']'),                      // [Transaction]
      seq('Enum', '(', sep1($.identifier, ','), ')'), // Enum(low, medium, high)
    ),

    // Namespace-qualified or bare: Identifier | ns.Identifier
    type_ref: $ => seq(
      $.identifier,
      optional(seq('.', $.identifier)),
    ),

    // ----------------------------------------------------------------
    // Lists and Items
    // ----------------------------------------------------------------

    type_list: $ => sep1($.type_reference, ','),

    // type_reference: TypeRef (optional annotation)
    //   e.g.  std.Prompt (A textual medical history)
    type_reference: $ => seq(
      $.type_ref,
      optional(seq('(', field('annotation', $.quoted_string), ')')),
    ),

    // Item in an input/output block — no trailing newline (sep-by handles it)
    typed_item: $ => seq(
      $.type_reference,
      optional($.quoted_string),
    ),

    // Item in a capabilities block — same structure, named for clarity
    cap_item: $ => seq(
      $.type_reference,
      optional($.quoted_string),
    ),

    // ----------------------------------------------------------------
    // Primitives
    // ----------------------------------------------------------------

    bare_string: $ => choice(
      $.quoted_string,
      $.filename,
      $.identifier,
    ),

    quoted_string: $ => /"[^"\\]*(?:\\.[^"\\]*)*"/,

    // Matches URLs: http:// or https:// followed by non-whitespace non-paren chars
    url: $ => /https?:\/\/[^\s)]+/,

    // Matches filenames with one or more dots: doctor.behavior, health.example.com
    filename: $ => /[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+/,

    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_-]*/,

    comment: $ => token(seq('//', /.*/)),
  },
});

// Helper: one or more `rule` separated by `separator`
function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}
