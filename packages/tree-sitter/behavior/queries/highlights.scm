; Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
; Licensed under the Apache License, Version 2.0
; http://www.apache.org/licenses/LICENSE-2.0

; flow/queries/highlights.scm — Tree-sitter highlight queries for the .behavior DSL

; ----------------------------------------------------------------
; Keywords — structural
; ----------------------------------------------------------------

"merge"    @keyword
"state"    @keyword

; ----------------------------------------------------------------
; Keywords — run actions
; ----------------------------------------------------------------

"run"        @keyword
"script"     @keyword.operator
"subagent"   @keyword.operator
"tool"       @keyword.operator
"silent"     @keyword.operator
"in"         @keyword
"background" @keyword.operator
"each"       @keyword.operator

; ----------------------------------------------------------------
; Keywords — interaction
; ----------------------------------------------------------------

"guide"     @keyword
"teach"     @keyword
"goal"      @keyword
"interact"  @keyword

; ----------------------------------------------------------------
; Keywords — memory
; ----------------------------------------------------------------

"set"         @keyword
"context"     @namespace
"session"     @namespace
"worksession" @namespace
"user"        @namespace

; ----------------------------------------------------------------
; Keywords — control flow
; ----------------------------------------------------------------

"if"           @keyword
"else"         @keyword
"transition"   @keyword
"to"           @keyword.operator

; ----------------------------------------------------------------
; Keywords — triggers
; ----------------------------------------------------------------

"on"        @keyword
"event"     @keyword.operator
"intent"    @keyword.operator
"offtopic"  @keyword.operator
"fallback"  @keyword.operator

; ----------------------------------------------------------------
; Keywords — temporal / parallel [experimental]
; ----------------------------------------------------------------

"after"    @keyword
"prompts"  @keyword.operator
"parallel" @keyword
"complete" @keyword.operator
"failed"   @keyword.operator

; ----------------------------------------------------------------
; Keywords — apply/remove
; ----------------------------------------------------------------

"apply"  @keyword
"remove" @keyword
"css"    @keyword.operator
"html"   @keyword.operator
"video"  @keyword.operator

; ----------------------------------------------------------------
; Memory operations
; ----------------------------------------------------------------

(assignment_op) @operator

(memory_target domain: (memory_domain) @namespace)
(memory_target var: (identifier) @variable)

; ----------------------------------------------------------------
; State and trigger declarations
; ----------------------------------------------------------------

(state_decl name: (path (identifier) @type.definition))
(trigger_decl event: (quoted_string) @string.special)

; ----------------------------------------------------------------
; Intent triggers
; ----------------------------------------------------------------

(intent_trigger intent: (quoted_string) @string.special)
(intent_trigger state: (path (identifier) @type))

; ----------------------------------------------------------------
; Transitions
; ----------------------------------------------------------------

(transition_stmt state: (path (identifier) @type))

; ----------------------------------------------------------------
; Run statements
; ----------------------------------------------------------------

(run_stmt target: (quoted_string) @string)
(run_stmt label: (quoted_string) @string)
(run_stmt collection: (path (identifier) @variable))

; ----------------------------------------------------------------
; Literals
; ----------------------------------------------------------------

(quoted_string)    @string
(number_literal)   @number
(boolean_literal)  @boolean
(null_literal)     @constant.builtin

; ----------------------------------------------------------------
; Comparison and logical operators
; ----------------------------------------------------------------

(comparison_op) @operator
(logical_op)    @keyword.operator

; ----------------------------------------------------------------
; Comments
; ----------------------------------------------------------------

(comment) @comment

; ----------------------------------------------------------------
; Merge paths
; ----------------------------------------------------------------

(merge_decl path: (quoted_string) @string.special)
