# `.flow` Grammar

Formal EBNF specification for the `.flow` DSL. This is the parser contract — map these rules to build an interpreter using Tree-sitter, ANTLR, or PEG.js.

To document a DSL formally, the industry standard is to use **EBNF (Extended Backus-Naur Form)** combined with a Language Reference Manual (LRM) style. This provides the exact rules needed to build a parser (e.g., using Tree-sitter, ANTLR, or PEG.js) that translates the human-readable text into an Abstract Syntax Tree (AST) for the engine.

---

## 1. Notation (EBNF)

The grammar is specified using the following conventions:
- `[...]` indicates optional elements.
- `{...}` indicates zero or more repetitions.
- `|` indicates alternatives.
- `"string"` indicates terminal keywords or symbols.
- `indent` and `dedent` represent logical block scoping (typically handled by whitespace parsing in languages like Python or YAML).

---

## 2. Lexical Structure

### Comments
Single-line comments start with `//` and continue to the end of the line.
```ebnf
comment = "//" , { any_character } , newline ;
```

### Identifiers
Identifiers are used for state names, variable names, and intents. They can contain letters, digits, underscores, and dots (for scoping).
```ebnf
identifier = letter , { letter | digit | "_" | "." } ;
```

### Literals
```ebnf
string_literal = '"' , { any_character_except_quote } , '"' ;
boolean_literal = "true" | "false" ;
number_literal = [ "-" ] , digit , { digit } , [ "." , digit , { digit } ] ;
null_literal = "null" ;
```

---

## 3. Top-Level Grammar

A `.flow` file consists of top-level declarations: Merge directives, Global Triggers, and States.

```ebnf
flow_file = { merge_decl | trigger_decl | state_decl } ;

merge_decl = "merge" , string_literal ;
```

`merge_decl` is **preamble-only**: it must appear before any `state` declaration and is resolved at compile time (eager). All states from the merged file join the same flat namespace as if written inline.

*Example:*
```flow
// preamble — before any state
merge "phases/planning.flow"
merge "phases/review.flow"

state responsive
  interact
  on intent "planning" next phases.planning.start
  on intent "review"   next phases.review.start
  on escape            next responsive
```

### 3.1. Memory Assignment
Defines stateful variables tracked by the runtime's Blackboard across 4 domains (`context`, `session`, `project`, `user`).

```ebnf
assignment_stmt = "set" , memory_domain , "." , identifier , "=" , expression ;
memory_domain = "context" | "session" | "project" | "user" ;
```
*Example:* `set session.active_phase = "planning"`

### 3.2. Global Observers (Triggers)
Listens for standard runtime events to execute actions outside the normal state flow.

```ebnf
trigger_decl = "on" , "event" , string_literal , block ;
```
*Example:* 
```dsl
on memory.backlog_count > 0
  run prompt "Warning" silent
```

### 3.3. State Declarations
Defines a specific state in the agent's lifecycle.

```ebnf
state_decl = "state" , identifier , block ;
```
*Example:* `state onboarding`

---

## 4. Blocks and Statements

A block is a sequence of statements, implicitly scoped by indentation. 

```ebnf
block = newline , indent , { statement } , dedent ;

statement = action_stmt 
          | conditional_stmt 
          | transition_stmt 
          | trigger_stmt 
          | temporal_stmt 
          | parallel_stmt ;
```

### 4.1. Actions
Actions are deterministic side-effects or external calls.

```ebnf
action_stmt = run_stmt | set_stmt | apply_stmt | remove_stmt | interaction_stmt ;

run_stmt = "run" , run_type , string_literal , [ string_literal ] , { run_modifier } ;
run_type = "script" | "subagent" | "tool" ;
run_modifier = "silent" | "in" "background" ;

interaction_stmt = guide_stmt | teach_stmt | goal_stmt | interact_stmt ;
guide_stmt = "guide" , string_literal ;
teach_stmt = "teach" , string_literal ;
goal_stmt = "goal" , string_literal ;
interact_stmt = "interact" , [ "requiring" , string_literal ] ;

set_stmt = "set" , identifier , assignment_op , expression ;
assignment_op = "=" | "+=" | "-=" ;

apply_stmt = "apply" , ui_target , string_literal ;
remove_stmt = "remove" , ui_target , string_literal ;
ui_target = "css" | "html" | "video" ;
```

### 4.2. Conditionals
Standard if/else branching.

```ebnf
conditional_stmt = "if" , condition , block , [ "else" , block ] ;
```

### 4.3. Transitions
Moves the execution cursor to another state.

```ebnf
transition_stmt = "next" , identifier ;
```

### 4.4. Intent Triggers (Inside States)
Listens for specific user intents interpreted by the LLM, effectively replacing traditional probabilistic routing.

```ebnf
trigger_stmt = "on" , "intent" , string_literal , ( "next" , identifier | block ) ;
escape_stmt  = "on" , "escape" , block ;
fallback_stmt = "on" , "fallback" , block ;
```

### 4.5. Temporal / Metric Blocks
Reacts to session metrics like the number of prompts exchanged while in the current state.

```ebnf
temporal_stmt = "after" , number_literal , "prompts" , block ;
```

### 4.6. Parallel Execution
Executes multiple statements concurrently and handles their combined completion status.

```ebnf
parallel_stmt = "parallel" , newline , indent , { statement } , dedent , { parallel_trigger } ;
parallel_trigger = "on" , ( "complete" | "failed" ) , block ;

batch_stmt = "run" , run_type , string_literal , "each" , identifier , { parallel_trigger } ;
```

---

## 5. Expressions and Conditions

Conditions and expressions support basic logical and arithmetic evaluations.

```ebnf
condition = expression , { logical_op , expression } ;
logical_op = "and" | "or" ;

expression = identifier 
           | string_literal 
           | number_literal 
           | boolean_literal 
           | null_literal
           | identifier , operator , expression ;

operator = "==" | "!=" | ">" | "<" | ">=" | "<=" ;
```

---

## How to use this documentation?
This document acts as the contract for anyone building a `.flow` interpreter. If you are writing a parser in Python, Rust, or JavaScript, you map these exact EBNF rules to generate an AST (Abstract Syntax Tree), ensuring that every implementation of `dot-agent-spec` interprets the DSL identically.
