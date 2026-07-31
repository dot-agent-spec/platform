// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use dot_agent_parser_dsl::parse_behavior;

#[test]
fn test_parse_minimal_behavior() {
    // Minimal valid behavior file: state + interact with intent handler
    let text = "state greeting\n  interact\n  on intent \"hello\" transition to chat\n";

    match parse_behavior(text) {
        Ok(behavior) => {
            eprintln!("✓ Parsed: {} states", behavior.states.len());
            assert_eq!(behavior.states.len(), 1, "Expected 1 state");
            assert_eq!(behavior.states[0].name, "greeting");
        }
        Err(e) => {
            eprintln!("Parse error: {}", e.0);
            panic!("Parse failed: {}", e.0);
        }
    }
}

#[test]
fn test_parse_error_message_format() {
    // Test that parse errors include line, column, and caret position
    let invalid_behavior = "state\n  interact";  // Missing state name

    match parse_behavior(invalid_behavior) {
        Ok(_) => {
            panic!("Expected parse error, but parsing succeeded");
        }
        Err(e) => {
            let msg = &e.0;
            eprintln!("Error message:\n{}", msg);

            // Verify error message contains required components
            assert!(msg.contains("Syntax error at line"),
                "Error should contain 'Syntax error at line'");
            assert!(msg.contains("column"),
                "Error should contain 'column'");
            assert!(msg.contains("^"),
                "Error should contain caret (^) pointing to error position");

            // Verify the code line is shown
            assert!(msg.contains("state") || msg.contains("interact"),
                "Error message should show the problematic code");
        }
    }
}

#[test]
fn test_valid_oriented_state() {
    // Valid oriented state: goal → interact (with handlers) → temporal
    let valid_behavior = "state welcome\n  goal \"Test\"\n  interact\n  on intent \"hi\" transition to chat\n  on offtopic transition to help";

    match parse_behavior(valid_behavior) {
        Ok(behavior) => {
            eprintln!("✓ Parsed valid oriented state");
            assert_eq!(behavior.states.len(), 1);
            assert_eq!(behavior.states[0].name, "welcome");
        }
        Err(e) => {
            eprintln!("Parse error:\n{}", e.0);
            panic!("Should parse valid oriented state: {}", e.0);
        }
    }
}

#[test]
fn test_interact_without_handlers_parses_after_forgiving_syntax() {
    // DA01-01 forgiving syntax: interact without handlers is now valid at parse time.
    // Semantic validation (W-series lint) happens in the compiler layer, not the parser.
    let behavior = "state welcome\n  goal \"Test\"\n  interact";

    match parse_behavior(behavior) {
        Ok(b) => {
            assert_eq!(b.states.len(), 1);
            assert_eq!(b.states[0].name, "welcome");
        }
        Err(e) => panic!("Should parse with forgiving grammar: {}", e.0),
    }
}
