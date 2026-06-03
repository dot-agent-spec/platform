extern crate dot_agent_kernel_dsl as kernel;
use kernel::parser::parse_behavior;

#[test]
fn test_parse_minimal_behavior() {
    // Minimal valid behavior file: state + interact + fallback handler (required by grammar)
    let text = "state greeting\n  interact\n  on fallback\n    transition to greeting\n";

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
