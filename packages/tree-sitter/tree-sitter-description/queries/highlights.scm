; Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
; Licensed under the Apache License, Version 2.0
; http://www.apache.org/licenses/LICENSE-2.0

; highlights.scm — Tree-sitter highlight queries for the .agent DSL
; Capture names follow the standard tree-sitter convention:
; https://tree-sitter.github.io/tree-sitter/syntax-highlighting#capture-names

; ----------------------------------------------------------------
; Keywords
; ----------------------------------------------------------------

"agent"        @keyword
"type"         @keyword
"description"  @keyword
"behavior"     @keyword
"persona"      @keyword
"requires"     @keyword
"input"        @keyword
"capabilities" @keyword
"output"       @keyword
"concept"      @keyword
"category"     @keyword
"domain"       @keyword
"license"      @keyword
"terms"        @keyword
"privacy"      @keyword

; ----------------------------------------------------------------
; Declarations
; ----------------------------------------------------------------

(agent_decl name: (agent_name) @type.definition)

(type_decl name: (identifier) @type.definition)

; ----------------------------------------------------------------
; Type references & Primitives
; ----------------------------------------------------------------

; Primitives (string, number, boolean, etc)
(primitive_type) @type.builtin

; Standard type references
(type_reference (identifier) @type)

; Namespace prefix (e.g., std in std.Prompt).
; This pattern naturally overrides the simple one above for the first identifier.
(type_reference
  (identifier) @namespace
  "."
  (identifier) @type)

; Type annotations: string(template "...")
(type_annotation) @attribute

; ----------------------------------------------------------------
; Properties inside a type block
; ----------------------------------------------------------------

(property_decl name: (identifier) @property)

; Optional marker (?)
(optional_marker) @operator

; Colon separator
":" @punctuation.delimiter

; ----------------------------------------------------------------
; Enum values
; ----------------------------------------------------------------

; Match "Enum" specifically as a builtin type
(type_value "Enum" @type.builtin)

; Match ANY identifier inside an Enum definition, regardless of commas
(type_value 
  "Enum"
  (identifier) @constant.builtin)

; ----------------------------------------------------------------
; Array brackets & Punctuation
; ----------------------------------------------------------------

"[" @punctuation.bracket
"]" @punctuation.bracket
"(" @punctuation.bracket
")" @punctuation.bracket
"," @punctuation.delimiter

; ----------------------------------------------------------------
; Literals
; ----------------------------------------------------------------

(quoted_string)  @string
(url)            @string.special
(filename)       @string
(text_content)   @string.documentation

; ----------------------------------------------------------------
; Agent metadata values
; ----------------------------------------------------------------

(agent_meta key: (agent_meta_key) @keyword value: (bare_string) @string.special)
(agent_meta key: (agent_meta_key) @keyword value: (url) @string.special)

; ----------------------------------------------------------------
; Category / Concept URIs
; ----------------------------------------------------------------

(category_prop uri: (url) @string.special)
(category_prop label: (ontology_label) @comment)

(concept_prop uri: (url) @string.special)
(concept_prop label: (ontology_label) @comment)

; ----------------------------------------------------------------
; File references
; ----------------------------------------------------------------

(behavior_block file: (bare_string) @string)
(persona_block file: (bare_string) @string)

; ----------------------------------------------------------------
; Comments
; ----------------------------------------------------------------

(comment) @comment
