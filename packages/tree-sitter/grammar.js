// grammar.js — Tree-sitter grammar for the Agent DSL
//
// Indentation (INDENT / DEDENT / NEWLINE) is handled by the external
// scanner in src/scanner.c — Tree-sitter has no native indent support.
//
// Structural decision (following examples, not original EBNF):
//   - agent metadata (domain, license, terms, privacy) is indented under `agent`
//   - semantic blocks (description, behavior, requires, input, capabilities, output)
//     are top-level statements that implicitly belong to the preceding agent
//
// Sep-by pattern:
//   Blocks use  seq(item, repeat(seq($._newline, item)), $._dedent)
//   instead of  repeat1(seq(item, $._newline))
//   This is necessary because the scanner emits DEDENT (not NEWLINE) for the
//   \n that follows the last item — so items must NOT consume their own newline.

module.exports = grammar({
  name: 'agent',

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

    manifest: $ => repeat1($.statement),

    statement: $ => choice(
      $.agent_decl,
      $.type_decl,
      $.description_block,
      $.behavior_block,
      $.requires_block,
      $.input_block,
      $.capabilities_block,
      $.output_block,
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
      choice(
        // No metadata block — just a name line
        $._newline,
        // Metadata block — sep-by pattern (items separated by _newline)
        seq(
          $._indent,
          $.agent_meta, repeat(seq($._newline, $.agent_meta)),
          $._dedent,
        ),
      ),
    ),

    // Supports single-word (Doctor) and multi-word (Mickey Mouse) names
    agent_name: $ => seq($.identifier, repeat($.identifier)),

    // agent_meta does NOT consume a trailing _newline.
    // The sep-by pattern in agent_decl handles newlines between items.
    agent_meta: $ => seq(
      field('key', choice('domain', 'license', 'terms', 'privacy')),
      field('value', choice($.url, $.bare_string)),
    ),

    // ----------------------------------------------------------------
    // Semantic Blocks  (top-level per examples)
    // ----------------------------------------------------------------

    description_block: $ => seq(
      'description',
      $._indent,
      $.text_content, repeat(seq($._newline, $.text_content)),
      $._dedent,
    ),

    // Free-form text line — low precedence so it yields to external tokens
    // Note: lines starting with // are consumed as $.comment (extras) first
    text_content: $ => token(prec(-1, /[^\n\r]+/)),

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
          $._indent,
          $.type_reference, repeat(seq($._newline, $.type_reference)),
          $._dedent,
        ),
      ),
    ),

    input_block: $ => seq(
      'input',
      choice(
        seq($.type_list, $._newline),
        seq(
          $._indent,
          $.typed_item, repeat(seq($._newline, $.typed_item)),
          $._dedent,
        ),
      ),
    ),

    capabilities_block: $ => seq(
      'capabilities',
      choice(
        seq($.type_list, $._newline),
        seq(
          $._indent,
          $.cap_item, repeat(seq($._newline, $.cap_item)),
          $._dedent,
        ),
      ),
    ),

    output_block: $ => seq(
      'output',
      choice(
        seq($.type_list, $._newline),
        seq(
          $._indent,
          $.typed_item, repeat(seq($._newline, $.typed_item)),
          $._dedent,
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
    type_property: $ => choice(
      $.concept_prop,
      $.schema_prop,
      $.property_decl,
    ),

    concept_prop: $ => seq(
      'concept',
      field('uri', $.url),
      optional(seq('(', field('label', $.bare_string), ')')),
    ),

    schema_prop: $ => seq(
      'schema',
      field('file', $.filename),
    ),

    // prop: Type?  "optional description"
    property_decl: $ => seq(
      field('name',           $.identifier),
      ':',
      field('type',           $.type_value),
      optional(field('optional_marker', '?')),
      optional(field('description',     $.quoted_string)),
    ),

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

    // Matches filenames with one or more dots: doctor.flow, health.example.com
    filename: $ => /[a-zA-Z0-9_-]+(\.[a-zA-Z0-9_-]+)+/,

    identifier: $ => /[a-zA-Z_][a-zA-Z0-9_-]*/,

    comment: $ => token(seq('//', /.*/)),
  },
});

// Helper: one or more `rule` separated by `separator`
function sep1(rule, separator) {
  return seq(rule, repeat(seq(separator, rule)));
}
