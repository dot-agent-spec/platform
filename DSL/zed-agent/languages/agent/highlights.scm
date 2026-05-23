; highlights.scm — Zed highlight queries for the Agent DSL

; ----------------------------------------------------------------
; Keywords
; ----------------------------------------------------------------

"agent"        @keyword
"type"         @keyword
"description"  @keyword
"behavior"     @keyword
"requires"     @keyword
"input"        @keyword
"capabilities" @keyword
"output"       @keyword
"concept"      @keyword
"schema"       @keyword
"domain"       @keyword
"license"      @keyword
"terms"        @keyword
"privacy"      @keyword
"Enum"         @keyword.operator

; ----------------------------------------------------------------
; Declarations
; ----------------------------------------------------------------

(agent_decl name: (agent_name (identifier) @type.definition))
(type_decl name: (identifier) @type.definition)

; ----------------------------------------------------------------
; Type references
; ----------------------------------------------------------------

; Bare type: Person, MedicalCondition
(type_ref (identifier) @type)

; Namespaced: std.Prompt — namespace dimmed, type highlighted
(type_ref
  (identifier) @namespace
  "."
  (identifier) @type)

; ----------------------------------------------------------------
; Properties inside a type block
; ----------------------------------------------------------------

(property_decl name: (identifier) @property)
(property_decl optional_marker: "?" @operator)

; ----------------------------------------------------------------
; Enum values
; ----------------------------------------------------------------

(type_value (identifier) @constant)

; ----------------------------------------------------------------
; Punctuation
; ----------------------------------------------------------------

":" @punctuation.delimiter
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
(text_content)   @string.doc

; ----------------------------------------------------------------
; Agent metadata
; ----------------------------------------------------------------

(agent_meta key: "license" (bare_string) @constant)
(concept_prop uri: (url) @string.special)

; ----------------------------------------------------------------
; Comments
; ----------------------------------------------------------------

(comment) @comment
