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

// grammar.js — Tree-sitter grammar for the .agent DSL.
// This file defines the manifest and type syntax used by .description and .type files.

// Design notes for maintainers:
//   - The grammar relies on explicit keywords and newline-driven structure instead of
//     fragile indentation heuristics.
//   - The `category` / `concept` split is the main semantic distinction for type metadata.
//   - Comments in this file explain intent and structure; they do not change parsing behavior.

module.exports = grammar({
  name: 'dot_agent',

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

    _newline: $ => /\r?\n/,

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
      $._newline, // Blank line separates metadata from optional blocks

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
    // Agent metadata and content blocks
    // ----------------------------------------------------------------

    description_block: $ => prec.right(seq(
      'description',
      $._newline,
      field('content', $.description_content),
      repeat($._newline), // Allow blank lines in description
    )),

    description_content: $ => prec.left(1,
      repeat1(
        seq($.text_content, $._newline),
      ),
    ),

    // Free-form text line.
    // The external `_newline` token already has higher priority than normal tokens,
    // so this rule does not need an extra precedence override.
    // This avoids incorrect tokenization of accented or non-ASCII text in descriptions.
    text_content: $ => token(/[^\n\r\s][^\n\r]*/),

    _blank_line: $ => prec(2, $._newline),

    persona_block: $ => prec.right(seq(
      'persona',
      field('file', $.bare_string),
      repeat($._newline),
    )),
    
    behavior_block: $ => prec.right(seq(
      'behavior',
      field('file', $.bare_string),
      repeat($._newline),
    )),

    requires_block: $ => prec.right(seq(
      'requires',
      choice(
        seq($.req_item, $._newline),
        seq($._newline, repeat1(seq($.req_item, $._newline)))
      ),
      repeat($._newline),
    )),

    input_block: $ => prec.right(seq(
      'input',
      choice(
        seq($._type_list_inline, $._newline), // Inline: input ExpenseLedger, Transaction
        seq($._newline, $._type_list_multiline), // Multiline
      ),
      repeat($._newline),
    )),

    capabilities_block: $ => prec.right(seq(
      'capabilities',
      choice(
        seq($.cap_item, $._newline),
        seq($._newline, repeat1(seq($.cap_item, $._newline)))
      ),
      repeat($._newline),
    )),

    output_block: $ => prec.right(seq(
      'output',
      choice(
        seq($._type_list_inline, $._newline),
        seq($._newline, $._type_list_multiline),
      ),
      repeat($._newline),
    )),

    // ----------------------------------------------------------------
    // Type declaration
    //
    //   type Prontuario
    //     category https://...
    //     concept https://...
    //     patient: Person "Paciente que será atendido"
    //     exames: [Exam]
    //     status: Enum(active, archived)
    //     imagem?: Avatar
    // ----------------------------------------------------------------

    type_decl: $ => seq(
      'type',
      field('name', $.identifier), $._newline,
      $.category_prop, $._newline,
      optional(seq($.concept_prop, $._newline)),
      repeat1(seq($.property_decl, choice($._newline, '\0'))),
    ),

    // The optional label in parentheses keeps the URI and a human-readable alias together.
    // Design verdict:
    //   - Type "Text" reads as a public contract or interface.
    //   - URI (Text) reads as an internal ontology documentation note.
    //   - Quoted text after a type may be shown to users.
    category_prop: $ => seq(
      'category',
      field('uri', $.url),
      optional(seq('(', field('label', $.ontology_label), ')')),
    ),

    concept_prop: $ => seq(
      'concept',
      field('uri', $.url),
      optional(seq('(', field('label', $.ontology_label), ')')),
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
    // Type values and composed forms
    // ----------------------------------------------------------------

    type_value: $ => choice(
      $.type_reference,                                         // Person | std.Prompt
      $.primitive_type,                                   // string | number | boolean
      seq($.primitive_type, '(', $.type_annotation, ')'), // string(maxLength: 100)
      seq('[', $.type_reference, ']'),                          // [Transaction]
      seq('Enum', '(', sep1($.identifier, ','), ')'),     // Enum(low, medium, high)
    ),

    primitive_type: $ => choice(
      'string',
      'number',
      'boolean',
      'text',
      'date',
      'datetime',
      'url',
    ),

    type_annotation: $ => /[^)]*/,

    // Supports both bare and namespace-qualified names: Identifier | ns.Identifier.
    type_reference: $ => seq(
      $.identifier,
      optional(seq('.', $.identifier)),
    ),

    // ----------------------------------------------------------------
    // Inline and multiline list helpers
    // ----------------------------------------------------------------

    _type_list_inline: $ => sep1($.type_reference, ','), // e.g. input ExpenseLedger, Transaction

    _type_list_multiline: $ => repeat1(seq($.typed_item, $._newline)),

    // Annotated reference form used in lists and metadata blocks.
    // Example: Avatar "Avatar image for user"
    typed_item: $ => $._annotated_reference,

    // Item in a capabilities block — same structure, named for clarity
    cap_item: $ => $._annotated_reference,

    // Item in a requirements block — same structure, named for clarity
    req_item: $ => $._annotated_reference, 

    _annotated_reference: $ => seq(
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
    
    ontology_label: $ => token(/[^)]+/),

    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_-]*/,

    comment: $ => token(seq('//', /.*/)),
  },
});

// Helper: one or more `rule` separated by `separator`
function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}
