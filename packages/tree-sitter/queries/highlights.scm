; highlights.scm — Tree-sitter highlight queries for the Agent DSL
; Capture names follow the standard tree-sitter convention:
; https://tree-sitter.github.io/tree-sitter/syntax-highlighting#capture-names

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
; Declarations — names get type.definition
; ----------------------------------------------------------------

(agent_decl name: (agent_name (identifier) @type.definition))

(type_decl name: (identifier) @type.definition)

; ----------------------------------------------------------------
; Type references — wherever a type name is used (not defined)
; ----------------------------------------------------------------

(type_ref (identifier) @type)

; Namespace prefix (std. in std.Prompt)  → dimmed
(type_ref
  (identifier) @namespace
  "."
  (identifier) @type)

; ----------------------------------------------------------------
; Properties inside a type block
; ----------------------------------------------------------------

(property_decl name: (identifier) @property)

; Optional marker
(optional_marker) @operator

; Colon separator in property_decl
":" @punctuation.delimiter

; ----------------------------------------------------------------
; Enum values
; ----------------------------------------------------------------

(type_value
  "Enum" @keyword.operator
  "(" @punctuation.bracket
  (identifier) @constant.builtin
  ")" @punctuation.bracket)

; ----------------------------------------------------------------
; Array brackets
; ----------------------------------------------------------------

"[" @punctuation.bracket
"]" @punctuation.bracket

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

; ----------------------------------------------------------------
; Concept URI — semantic anchor, highlight like a special string
; ----------------------------------------------------------------

(concept_prop uri: (url) @string.special)
(concept_prop label: (bare_string) @comment)

; ----------------------------------------------------------------
; Schema file reference
; ----------------------------------------------------------------

(schema_prop file: (filename) @string)

; ----------------------------------------------------------------
; Behavior file reference
; ----------------------------------------------------------------

(behavior_block file: (bare_string) @string)

; ----------------------------------------------------------------
; Comments
; ----------------------------------------------------------------

(comment) @comment
