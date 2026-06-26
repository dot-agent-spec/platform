// Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use crate::ast::{BehaviorFile, Statement, IntentBody};

/// Serialize the FSM as SCXML (W3C, https://www.w3.org/TR/scxml/).
/// Does NOT annotate with _active — that is the kernel's responsibility at runtime.
/// States with no outgoing transitions are emitted as <final>.
pub fn to_scxml(behavior: &BehaviorFile) -> String {
    let initial = behavior.states.first().map(|s| s.name.as_str()).unwrap_or("");

    let mut out = String::new();
    out.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    out.push_str(&format!(
        "<scxml xmlns=\"http://www.w3.org/2005/07/scxml\" version=\"1.0\" initial=\"{}\">\n",
        escape_xml(initial)
    ));

    for state in &behavior.states {
        let transitions = collect_scxml_transitions(&state.body);
        if transitions.is_empty() {
            out.push_str(&format!("  <final id=\"{}\"/>\n", escape_xml(&state.name)));
        } else {
            out.push_str(&format!("  <state id=\"{}\">\n", escape_xml(&state.name)));
            for (event, target) in &transitions {
                match event {
                    Some(ev) => out.push_str(&format!(
                        "    <transition event=\"{}\" target=\"{}\"/>\n",
                        escape_xml(ev),
                        escape_xml(target)
                    )),
                    None => out.push_str(&format!(
                        "    <transition target=\"{}\"/>\n",
                        escape_xml(target)
                    )),
                }
            }
            out.push_str("  </state>\n");
        }
    }

    out.push_str("</scxml>");
    out
}

/// Return all state names declared in the behavior, in declaration order.
pub fn list_states(behavior: &BehaviorFile) -> Vec<String> {
    behavior.states.iter().map(|s| s.name.clone()).collect()
}

/// Return all intents declared within the interact block of the given state.
/// Returns an empty vec if the state does not exist or has no interact statement.
/// Note: intent_trigger nodes appear as siblings in the state body (not nested inside
/// interact_stmt.handlers) due to how the grammar is structured.
pub fn intents_for_state(behavior: &BehaviorFile, state_name: &str) -> Vec<String> {
    let Some(state) = behavior.states.iter().find(|s| s.name == state_name) else {
        return vec![];
    };

    let mut intents = Vec::new();
    for stmt in &state.body {
        match stmt {
            // Handlers nested inside interact_stmt (if present)
            Statement::Interact { handlers } => {
                for handler in handlers {
                    if let Statement::OnIntent { intent, .. } = handler {
                        intents.push(intent.clone());
                    }
                }
            }
            // intent_trigger siblings in state body (current grammar behavior)
            Statement::OnIntent { intent, .. } => {
                intents.push(intent.clone());
            }
            _ => {}
        }
    }
    intents
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/// Collect (event?, target) pairs from a statement list for SCXML generation.
fn collect_scxml_transitions(stmts: &[Statement]) -> Vec<(Option<String>, String)> {
    let mut result = Vec::new();
    for stmt in stmts {
        match stmt {
            Statement::Transition { target } => {
                result.push((None, target.clone()));
            }
            // intent_trigger / offtopic_stmt as direct state body siblings (current grammar)
            Statement::OnIntent { intent, body } => match body {
                IntentBody::Next(target) => {
                    result.push((Some(intent.clone()), target.clone()));
                }
                IntentBody::Block(inner) => {
                    for (_, target) in collect_scxml_transitions(inner) {
                        result.push((Some(intent.clone()), target));
                    }
                }
            },
            Statement::OnOfftopic { body } => {
                for (_, target) in collect_scxml_transitions(body) {
                    result.push((Some("offtopic".to_string()), target));
                }
            }
            Statement::Interact { handlers } => {
                for handler in handlers {
                    match handler {
                        Statement::OnIntent { intent, body } => match body {
                            IntentBody::Next(target) => {
                                result.push((Some(intent.clone()), target.clone()));
                            }
                            IntentBody::Block(inner) => {
                                for (_, target) in collect_scxml_transitions(inner) {
                                    result.push((Some(intent.clone()), target));
                                }
                            }
                        },
                        Statement::OnOfftopic { body } => {
                            for (_, target) in collect_scxml_transitions(body) {
                                result.push((Some("offtopic".to_string()), target));
                            }
                        }
                        _ => {}
                    }
                }
            }
            Statement::After { prompts, body } => {
                for (_, target) in collect_scxml_transitions(body) {
                    result.push((Some(format!("after_{}_prompts", prompts)), target));
                }
            }
            Statement::Parallel { body, on_failed } => {
                result.extend(collect_scxml_transitions(body));
                if let Some(stmts) = on_failed {
                    for (_, target) in collect_scxml_transitions(stmts) {
                        result.push((Some("failed".to_string()), target));
                    }
                }
            }
            Statement::If { then_body, else_body, .. } => {
                result.extend(collect_scxml_transitions(then_body));
                if let Some(stmts) = else_body {
                    result.extend(collect_scxml_transitions(stmts));
                }
            }
            _ => {}
        }
    }
    result
}

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(test)]
mod tests {
    use super::{to_scxml, list_states, intents_for_state};
    use crate::parser::parse_behavior;

    fn parse(src: &str) -> crate::ast::BehaviorFile {
        parse_behavior(src).unwrap_or_else(|e| panic!("parse failed: {}", e.0))
    }

    const THREE_STATE: &str = r#"
state alpha
  goal "Alpha."
  interact
  on intent "next" transition to beta
  on offtopic transition to alpha

state beta
  goal "Beta."
  interact
  on intent "done" transition to gamma
  on offtopic transition to beta

state gamma
  goal "Gamma."
  interact
  on intent "end" transition to gamma
  on offtopic transition to gamma
"#;

    #[test]
    fn list_states_returns_declaration_order() {
        let bf = parse(THREE_STATE);
        assert_eq!(list_states(&bf), vec!["alpha", "beta", "gamma"]);
    }

    #[test]
    fn list_states_empty_behavior_file() {
        // Construct an empty BehaviorFile directly — the grammar doesn't accept empty input.
        let bf = crate::ast::BehaviorFile { states: vec![], global_triggers: vec![], merges: vec![] };
        assert!(list_states(&bf).is_empty());
    }

    #[test]
    fn intents_collected_from_sibling_triggers() {
        let src = r#"
state s
  goal "S."
  interact
  on intent "yes" transition to t
  on intent "no" transition to s
  on offtopic transition to s

state t
  goal "T."
  interact
  on intent "stay" transition to t
  on offtopic transition to t
"#;
        let bf = parse(src);
        let intents = intents_for_state(&bf, "s");
        assert!(intents.contains(&"yes".to_string()), "expected 'yes' intent");
        assert!(intents.contains(&"no".to_string()), "expected 'no' intent");
    }

    #[test]
    fn intents_unknown_state_returns_empty() {
        let bf = parse(THREE_STATE);
        assert!(intents_for_state(&bf, "nonexistent").is_empty());
    }

    #[test]
    fn intents_setup_state_returns_empty() {
        let src = r#"
state init
  run tool "Bootstrap"
  transition to main

state main
  goal "Main."
  interact
  on intent "continue" transition to main
  on offtopic transition to main
"#;
        let bf = parse(src);
        assert!(intents_for_state(&bf, "init").is_empty());
    }

    #[test]
    fn scxml_initial_state_is_first_declared() {
        let bf = parse(THREE_STATE);
        let xml = to_scxml(&bf);
        assert!(xml.contains("initial=\"alpha\""), "initial= should be 'alpha', got:\n{xml}");
    }

    #[test]
    fn scxml_state_without_transitions_is_final() {
        let src = r#"
state main
  goal "Main."
  interact
  on intent "done" transition to finished
  on offtopic transition to main

state finished
  run tool "Cleanup"
"#;
        let bf = parse(src);
        let xml = to_scxml(&bf);
        assert!(xml.contains("<final id=\"finished\"/>"), "expected <final> for 'finished', got:\n{xml}");
    }

    #[test]
    fn scxml_intent_transition_has_event_and_target() {
        let src = r#"
state main
  goal "Main."
  interact
  on intent "confirm" transition to done
  on offtopic transition to main

state done
  goal "Done."
  interact
  on intent "restart" transition to done
  on offtopic transition to done
"#;
        let bf = parse(src);
        let xml = to_scxml(&bf);
        assert!(xml.contains("event=\"confirm\""), "expected event=confirm in:\n{xml}");
        assert!(xml.contains("target=\"done\""), "expected target=done in:\n{xml}");
    }

    #[test]
    fn scxml_offtopic_uses_offtopic_event_name() {
        let bf = parse(THREE_STATE);
        let xml = to_scxml(&bf);
        assert!(xml.contains("event=\"offtopic\""), "expected offtopic event in:\n{xml}");
    }

    #[test]
    fn scxml_intent_with_ampersand_is_xml_escaped() {
        let src = r#"
state shop
  goal "Shop."
  interact
  on intent "order & pay" transition to checkout
  on offtopic transition to shop

state checkout
  goal "Checkout."
  interact
  on intent "cancel" transition to checkout
  on offtopic transition to checkout
"#;
        let bf = parse(src);
        let xml = to_scxml(&bf);
        assert!(xml.contains("order &amp; pay"), "expected XML-escaped & in:\n{xml}");
        assert!(!xml.contains("order & pay"), "raw & should not appear in XML output");
    }

    #[test]
    fn scxml_output_has_valid_xml_envelope() {
        let bf = parse(THREE_STATE);
        let xml = to_scxml(&bf);
        assert!(xml.starts_with("<?xml"), "should start with XML declaration");
        assert!(xml.contains("<scxml "), "should contain <scxml element");
        assert!(xml.ends_with("</scxml>"), "should end with </scxml>");
    }
}
