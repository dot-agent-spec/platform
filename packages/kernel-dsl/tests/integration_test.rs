// SPDX-License-Identifier: Apache-2.0

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

// ── The serialized wire shape ────────────────────────────────────────────────
//
// The unit tests in src/engine assert on the Rust enum; JavaScript never sees that. What crosses
// the WASM boundary is this JSON, and `content` sitting beside `text` is the whole contract a host
// reads (`effect.content ?? effect.text`).

#[test]
fn teach_effect_serializes_both_text_and_resolved_content() {
    use dot_agent_kernel_dsl::engine::AgentDSLKernel;
    use std::collections::BTreeMap;

    let dsl = "state init\n  teach \"knowledge/cars.md\"\n  interact\n";

    let mut content_files = BTreeMap::new();
    content_files.insert("knowledge/cars.md".to_string(), "# Cars".to_string());

    let mut kernel = AgentDSLKernel::new();
    kernel.set_content_files(content_files);
    let effects = kernel
        .load_behavior_with_bundle(dsl, &BTreeMap::new())
        .expect("should load");

    let teach = effects
        .iter()
        .map(|e| serde_json::to_value(e).expect("effect must serialize"))
        .find(|v| v["type"] == "teach")
        .expect("expected a teach effect");

    assert_eq!(teach["text"], "knowledge/cars.md", "the path must stay on the wire");
    assert_eq!(teach["content"], "# Cars", "the resolved content must ride beside it");
}

#[test]
fn unresolved_teach_serializes_content_as_null_rather_than_omitting_it() {
    use dot_agent_kernel_dsl::engine::AgentDSLKernel;
    use std::collections::BTreeMap;

    let dsl = "state init\n  teach \"knowledge/missing.md\"\n  interact\n";

    let mut kernel = AgentDSLKernel::new();
    let effects = kernel
        .load_behavior_with_bundle(dsl, &BTreeMap::new())
        .expect("an unresolvable teach must not fail the load");

    let teach = effects
        .iter()
        .map(|e| serde_json::to_value(e).expect("effect must serialize"))
        .find(|v| v["type"] == "teach")
        .expect("expected a teach effect");

    assert!(
        teach.get("content").is_some(),
        "the key must always be present, so a host can read content ?? text"
    );
    assert!(teach["content"].is_null(), "an unresolved path serializes as null");
}
