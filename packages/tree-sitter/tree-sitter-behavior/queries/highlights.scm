; Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
; Licensed under the Apache License, Version 2.0
; http://www.apache.org/licenses/LICENSE-2.0

; behavior/queries/highlights.scm — Tree-sitter highlight queries for the .behavior DSL

; ----------------------------------------------------------------
; Keywords — structural
; ----------------------------------------------------------------

"merge"  @keyword
"state"  @keyword

; ----------------------------------------------------------------
; Keywords — run actions
; ----------------------------------------------------------------

"run"      @keyword
"script"   @keyword.operator
"subagent" @keyword.operator
"tool"     @keyword.operator

; ----------------------------------------------------------------
; Keywords — interaction
; ----------------------------------------------------------------

"goal"      @keyword
"guide"     @keyword
"teach"     @keyword
(interact_stmt) @keyword

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

"if"         @keyword
"else"       @keyword
"end"        @keyword
"transition" @keyword
"to"         @keyword.operator

; ----------------------------------------------------------------
; Keywords — triggers
; ----------------------------------------------------------------

"on"       @keyword
"event"    @keyword.operator
"intent"   @keyword.operator
"offtopic" @keyword.operator
"failure"  @keyword.operator
"success"  @keyword.operator

; ----------------------------------------------------------------
; Keywords — temporal / parallel
; ----------------------------------------------------------------

"after"    @keyword
"prompts"  @keyword.operator
"parallel" @keyword

; ----------------------------------------------------------------
; Keywords — apply/remove
; ----------------------------------------------------------------

"apply"  @keyword
"remove" @keyword
"css"    @keyword.operator

; ----------------------------------------------------------------
; Keywords — values
; ----------------------------------------------------------------

"true"  @boolean
"false" @boolean
(null)  @constant.builtin

; ----------------------------------------------------------------
; Memory operations
; ----------------------------------------------------------------

(assignment_op) @operator

(memory_target domain: (memory_domain) @namespace)
(memory_target var: (identifier) @variable)

; ----------------------------------------------------------------
; State and trigger declarations
; ----------------------------------------------------------------

(state_decl name: (state_name) @type.definition)
(trigger_decl event: (quoted_string) @string.special)

; ----------------------------------------------------------------
; Intent handlers
; ----------------------------------------------------------------

(intent_handler intent: (quoted_string) @string.special)

; ----------------------------------------------------------------
; Transitions
; ----------------------------------------------------------------

(transition_stmt state: (state_name) @type)

; ----------------------------------------------------------------
; Run statements
; ----------------------------------------------------------------

(run_stmt target: (quoted_string) @string)
(run_stmt parameters: (quoted_string) @string)

; ----------------------------------------------------------------
; Literals
; ----------------------------------------------------------------

(quoted_string)      @string
(with_quotes_string) @string
(number)             @number

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

(merge_decl path: (filename) @string.special)
