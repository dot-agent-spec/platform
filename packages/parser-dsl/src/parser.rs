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

use crate::ast;
use tree_sitter::{Parser, Node};
use serde_json::{Value, json, Map};

include!(concat!(env!("OUT_DIR"), "/node_kinds.rs"));

#[derive(Debug)]
pub struct ParseError(pub String);

fn find_first_error(node: Node) -> Option<Node> {
    if node.is_error() || node.is_missing() {
        return Some(node);
    }
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if let Some(err) = find_first_error(child) {
            return Some(err);
        }
    }
    None
}

pub fn parse_behavior(text: &str) -> Result<ast::BehaviorFile, ParseError> {
    let mut parser = Parser::new();
    parser.set_language(&dot_agent_tree_sitter::language_behavior())
        .map_err(|_| ParseError("Failed to load behavior language".to_string()))?;

    let tree = parser.parse(text, None)
        .ok_or_else(|| ParseError("Failed to parse behavior".to_string()))?;

    let root_node = tree.root_node();
    if root_node.has_error() {
        let message = if let Some(err_node) = find_first_error(root_node) {
            let pos = err_node.start_position();
            let line_num = pos.row + 1;
            let col_num = pos.column + 1;
            let line_text = text.lines().nth(pos.row).unwrap_or("");

            // Validate that the error position is within the line bounds
            if col_num > line_text.len() + 1 {
                // Error is beyond line end — likely a structural error
                format!(
                    "Syntax error in behavior file\n\nCheck that:\n  - Oriented states follow: goal? guide? teach* interact\n  - interact must contain: on intent \"...\" / on offtopic handlers\n  - Setup states use: run/set/transition (no interact needed)"
                )
            } else {
                let caret = format!("{}^", " ".repeat(if col_num > 1 { col_num - 1 } else { 0 }));
                format!(
                    "Syntax error at line {}, column {}:\n  {}\n  {}",
                    line_num, col_num, line_text, caret
                )
            }
        } else {
            "Syntax error in behavior file".to_string()
        };
        return Err(ParseError(message));
    }

    let value = node_to_value(root_node, text);
    serde_json::from_value(value)
        .map_err(|e| ParseError(format!("Failed to map tree to AST: {}", e)))
}

fn node_to_value(node: Node, source: &str) -> Value {
    let kind = node.kind();

    // interact_stmt must be handled before the leaf check: in v0.4.0 it is a pure-keyword
    // node (child_count() == 0) but must produce {"type":"interact_stmt","handlers":[]}.
    if kind == "interact_stmt" {
        let mut handlers = Vec::new();
        let mut cursor = node.walk();
        for child in node.named_children(&mut cursor) {
            if child.kind() == "intent_handler" || child.kind() == "offtopic_handler" {
                handlers.push(node_to_value(child, source));
            }
        }
        let mut map = Map::new();
        map.insert("type".to_string(), json!("interact_stmt"));
        map.insert("handlers".to_string(), json!(handlers));
        return Value::Object(map);
    }

    // run_type is a keyword-choice node (tool/script/subagent).
    // Its byte_range may include a leading space in indentation-sensitive grammars, so trim.
    if kind == "run_type" {
        return json!(source[node.byte_range()].trim());
    }

    if node.child_count() == 0 || kind == "identifier" || kind == "quoted_string" || kind == "number_literal" || kind == "path" {
        let text = &source[node.byte_range()];
        if kind == "quoted_string" && text.starts_with('"') && text.ends_with('"') {
            return json!(text[1..text.len()-1].to_string());
        }
        return json!(text);
    }

    // Special handling for state_decl: flatten body into statement list
    // NOTE: state_decl is a wrapper, NOT a Statement variant — don't add "type" tag
    if kind == "state_decl" {
        let mut map = Map::new();

        if let Some(name_node) = node.child_by_field_name("name") {
            map.insert("name".to_string(), node_to_value(name_node, source));
        }

        let mut body_statements = Vec::new();

        if let Some(body_wrapper) = node.child_by_field_name("body") {
            // v0.4.0: state_decl has a named "body" field (state_body node)
            // state_body children: oriented_state_body | block (for setup)
            let mut cursor = body_wrapper.walk();
            for child in body_wrapper.named_children(&mut cursor) {
                match child.kind() {
                    "oriented_state_body" => {
                        body_statements.extend(extract_state_body_statements(child, source));
                    }
                    "block" => {
                        body_statements.extend(extract_block_statements(child, source));
                    }
                    _ => {}
                }
            }
        } else {
            // v0.3.x fallback: oriented_state_body/setup_state_body as unnamed children
            let mut cursor = node.walk();
            for child in node.named_children(&mut cursor) {
                match child.kind() {
                    "oriented_state_body" | "setup_state_body" => {
                        body_statements.extend(extract_state_body_statements(child, source));
                    }
                    _ => {}
                }
            }
        }

        map.insert("body".to_string(), json!(body_statements));
        return Value::Object(map);
    }

    if kind == "behavior_file" {
        let mut map = Map::new();
        let mut states = Vec::new();
        let mut global_triggers = Vec::new();
        let mut merges = Vec::new();

        let mut cursor = node.walk();
        for child in node.named_children(&mut cursor) {
            match child.kind() {
                "state_decl" => states.push(node_to_value(child, source)),
                "trigger_decl" => global_triggers.push(node_to_value(child, source)),
                "merge_decl" => {
                    if let Some(p) = child.child_by_field_name("path") {
                        merges.push(node_to_value(p, source));
                    }
                }
                _ => {}
            }
        }
        map.insert("states".to_string(), json!(states));
        map.insert("global_triggers".to_string(), json!(global_triggers));
        map.insert("merges".to_string(), json!(merges));
        return Value::Object(map);
    }

    // Special handling for trigger_decl: not a Statement variant
    // v0.4.0: block is a named field with block type (statement wrappers)
    if kind == "trigger_decl" {
        let mut map = Map::new();

        if let Some(event_node) = node.child_by_field_name("event") {
            map.insert("event".to_string(), node_to_value(event_node, source));
        }

        let mut body_statements = Vec::new();
        if let Some(block_node) = node.child_by_field_name("block") {
            body_statements.extend(extract_block_statements(block_node, source));
        }
        map.insert("body".to_string(), json!(body_statements));

        return Value::Object(map);
    }

    let mut map = Map::new();
    let mut type_name = kind.to_string();

    match kind {
        // ── Intent handler (v0.4.0: intent_handler node) ──────────────────────
        // Inline:  on intent "X" transition to Y  →  IntentBody::Next("Y")
        // Block:   on intent "X"\n  stmts...      →  IntentBody::Block([...])
        // Emits type = "intent_trigger" to keep AST serde compatibility.
        "intent_handler" => {
            if let Some(intent_node) = node.child_by_field_name("intent") {
                map.insert("intent".to_string(), node_to_value(intent_node, source));
            }
            if let Some(block_node) = node.child_by_field_name("block") {
                let body_stmts = extract_block_statements(block_node, source);
                map.insert("body".to_string(), json!(body_stmts));
            } else {
                // inline: transition_stmt is an unnamed named child
                let inline_val = {
                    let mut c = node.walk();
                    let x = node.named_children(&mut c)
                        .find(|ch| ch.kind() == "transition_stmt")
                        .and_then(|t| t.child_by_field_name("state"))
                        .map(|s| node_to_value(s, source));
                    x
                };
                if let Some(val) = inline_val {
                    map.insert("body".to_string(), val);
                }
            }
            type_name = "intent_trigger".to_string();
        }

        // ── Offtopic handler (v0.4.0: offtopic_handler node) ──────────────────
        // Emits type = "offtopic_stmt" to keep AST serde compatibility.
        "offtopic_handler" => {
            if let Some(block_node) = node.child_by_field_name("block") {
                let body_stmts = extract_block_statements(block_node, source);
                map.insert("body".to_string(), json!(body_stmts));
            } else {
                // inline: on offtopic transition to X
                let inline_val = {
                    let mut c = node.walk();
                    let x = node.named_children(&mut c)
                        .find(|ch| ch.kind() == "transition_stmt")
                        .and_then(|t| t.child_by_field_name("state"))
                        .map(|s| {
                            let target_str = &source[s.byte_range()];
                            let transition = json!({ "type": "transition_stmt", "state": target_str });
                            json!(vec![transition])
                        });
                    x
                };
                if let Some(val) = inline_val {
                    map.insert("body".to_string(), val);
                }
            }
            type_name = "offtopic_stmt".to_string();
        }

        // ── Run statement ──────────────────────────────────────────────────────
        // Grammar uses field "type" for run kind, but AST expects field "kind".
        // Without special handling the generic branch would overwrite "type" with
        // the node kind name ("run_stmt"), losing the run kind value.
        "run_stmt" => {
            if let Some(t) = node.child_by_field_name("type") {
                map.insert("kind".to_string(), node_to_value(t, source));
            }
            if let Some(t) = node.child_by_field_name("target") {
                map.insert("target".to_string(), node_to_value(t, source));
            }
            if let Some(p) = node.child_by_field_name("parameters") {
                map.insert("label".to_string(), node_to_value(p, source));
            }
            // failure_stmt child → on_failed
            let mut c = node.walk();
            for child in node.named_children(&mut c) {
                if child.kind() == "failure_stmt" {
                    if let Some(blk) = child.child_by_field_name("block") {
                        map.insert("on_failed".to_string(), json!(extract_block_statements(blk, source)));
                    }
                }
            }
        }

        // ── Parallel statement ─────────────────────────────────────────────────
        // body from handler_block field; on_complete/on_failed from child stmts
        "parallel_stmt" => {
            if let Some(blk) = node.child_by_field_name("block") {
                map.insert("body".to_string(), json!(extract_handler_block_statements(blk, source)));
            } else {
                map.insert("body".to_string(), json!(Vec::<Value>::new()));
            }
            let mut c = node.walk();
            for child in node.named_children(&mut c) {
                match child.kind() {
                    "success_stmt" => {
                        if let Some(blk) = child.child_by_field_name("block") {
                            map.insert("on_complete".to_string(), json!(extract_block_statements(blk, source)));
                        }
                    }
                    "failure_stmt" => {
                        if let Some(blk) = child.child_by_field_name("block") {
                            map.insert("on_failed".to_string(), json!(extract_block_statements(blk, source)));
                        }
                    }
                    _ => {}
                }
            }
        }

        // ── Conditional statement ──────────────────────────────────────────────
        // then/else fields are block nodes; unwrap their statement wrappers
        "conditional_stmt" => {
            if let Some(cond) = node.child_by_field_name("condition") {
                map.insert("condition".to_string(), node_to_value(cond, source));
            }
            if let Some(blk) = node.child_by_field_name("then") {
                map.insert("then".to_string(), json!(extract_block_statements(blk, source)));
            }
            if let Some(blk) = node.child_by_field_name("else") {
                map.insert("else".to_string(), json!(extract_block_statements(blk, source)));
            }
        }

        _ => {
            // Generic handling: iterate all children and extract field names
            let mut cursor = node.walk();
            let mut unnamed_children = Vec::new();
            let mut child_idx = 0;

            for child in node.children(&mut cursor) {
                if child.is_extra() {
                    child_idx += 1;
                    continue;
                }

                // field_name_for_child expects the index among ALL children (including unnamed)
                let field_name = node.field_name_for_child(child_idx as u32).map(|s| s.to_string());
                if let Some(fname) = field_name {
                    map.insert(fname, node_to_value(child, source));
                } else if child.is_named() {
                    unnamed_children.push(node_to_value(child, source));
                }

                child_idx += 1;
            }

            // Add unnamed named children to "body" if the node is block-like
            if !unnamed_children.is_empty()
                && (kind.ends_with("_body") || kind == "block" || kind.ends_with("_block"))
            {
                map.insert("body".to_string(), json!(unnamed_children));
            }
        }
    }

    map.insert("type".to_string(), json!(type_name));
    Value::Object(map)
}

/// Extract statements from a `block` node (v0.4.0 style).
/// `block` wraps each statement in a `statement` node; this unwraps them.
/// Falls back to direct handler_block-style children if no statement wrapper is found.
fn extract_block_statements(block_node: Node, source: &str) -> Vec<Value> {
    let mut stmts = Vec::new();
    let mut cursor = block_node.walk();
    for child in block_node.named_children(&mut cursor) {
        if child.kind() == "statement" {
            let mut c2 = child.walk();
            for inner in child.named_children(&mut c2) {
                stmts.push(node_to_value(inner, source));
            }
        } else if is_handler_block_kind(child.kind()) {
            stmts.push(node_to_value(child, source));
        }
    }
    stmts
}

fn extract_state_body_statements(body_node: Node, source: &str) -> Vec<Value> {
    let mut stmts = Vec::new();
    let mut cursor = body_node.walk();

    for child in body_node.named_children(&mut cursor) {
        if is_state_body_kind(child.kind()) {
            stmts.push(node_to_value(child, source));
        }
    }

    stmts
}

fn extract_handler_block_statements(block_node: Node, source: &str) -> Vec<Value> {
    let mut stmts = Vec::new();
    let mut cursor = block_node.walk();

    for child in block_node.named_children(&mut cursor) {
        if is_handler_block_kind(child.kind()) {
            stmts.push(node_to_value(child, source));
        }
    }

    stmts
}

#[cfg(test)]
mod tests {
    use super::parse_behavior;
    use crate::ast::{Statement, IntentBody};

    fn must_parse(src: &str) -> crate::ast::BehaviorFile {
        parse_behavior(src).unwrap_or_else(|e| panic!("parse failed: {}", e.0))
    }

    // Two-state fixture used across several tests
    const TWO_STATE: &str = r#"
state welcome
  goal "Greet the user."
  interact
  on intent "start" transition to done
  on offtopic transition to welcome

state done
  goal "Finish."
  interact
  on intent "restart" transition to done
  on offtopic transition to done
"#;

    #[test]
    fn parse_minimal_oriented_state() {
        let bf = must_parse(TWO_STATE);
        assert_eq!(bf.states.len(), 2);
        assert_eq!(bf.states[0].name, "welcome");
        assert_eq!(bf.states[1].name, "done");
    }

    #[test]
    fn parse_goal_guide_teach_all_present() {
        let src = r#"
state s
  goal "Goal."
  guide "Guide."
  teach "Teach."
  interact
  on intent "continue" transition to s
  on offtopic transition to s
"#;
        let bf = must_parse(src);
        let body = &bf.states[0].body;
        assert!(body.iter().any(|s| matches!(s, Statement::Goal { .. })), "missing goal");
        assert!(body.iter().any(|s| matches!(s, Statement::Guide { .. })), "missing guide");
        assert!(body.iter().any(|s| matches!(s, Statement::Teach { .. })), "missing teach");
    }

    #[test]
    fn parse_multiple_states_preserve_order() {
        let src = r#"
state alpha
  goal "Alpha."
  interact
  on intent "next" transition to beta
  on offtopic transition to alpha

state beta
  goal "Beta."
  interact
  on intent "next" transition to gamma
  on offtopic transition to beta

state gamma
  goal "Gamma."
  interact
  on intent "end" transition to gamma
  on offtopic transition to gamma
"#;
        let bf = must_parse(src);
        let names: Vec<&str> = bf.states.iter().map(|s| s.name.as_str()).collect();
        assert_eq!(names, vec!["alpha", "beta", "gamma"]);
    }

    #[test]
    fn parse_setup_state_with_run_and_transition() {
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
        let bf = must_parse(src);
        assert_eq!(bf.states[0].name, "init");
        let has_transition = bf.states[0].body.iter().any(|s| matches!(s, Statement::Transition { .. }));
        assert!(has_transition, "init state should have a transition statement");
    }

    #[test]
    fn parse_merge_directive() {
        let src = r#"
merge "other.behavior"

state main
  goal "Main."
  interact
  on intent "continue" transition to main
  on offtopic transition to main
"#;
        let bf = must_parse(src);
        assert_eq!(bf.merges, vec!["other.behavior"]);
    }

    #[test]
    fn parse_global_event_trigger() {
        // trigger_decl uses indentation-based block (no braces)
        let src = "on event \"action_failed\"\n  run script \"cleanup.sh\"\n\nstate main\n  goal \"Main.\"\n  interact\n  on intent \"continue\" transition to main\n  on offtopic transition to main\n";
        let bf = must_parse(src);
        assert_eq!(bf.global_triggers.len(), 1);
        assert_eq!(bf.global_triggers[0].event, "action_failed");
        assert!(!bf.global_triggers[0].body.is_empty());
    }

    #[test]
    fn parse_dotted_state_names() {
        let src = r#"
state planning.init
  goal "Planning init."
  interact
  on intent "done" transition to planning.next
  on offtopic transition to planning.init

state planning.next
  goal "Planning next."
  interact
  on intent "end" transition to planning.next
  on offtopic transition to planning.next
"#;
        let bf = must_parse(src);
        assert_eq!(bf.states[0].name, "planning.init");
        assert_eq!(bf.states[1].name, "planning.next");
    }

    #[test]
    fn parse_intent_inline_form_produces_next_body() {
        let bf = must_parse(TWO_STATE);
        let on_intent = bf.states[0].body.iter()
            .find(|s| matches!(s, Statement::OnIntent { .. }))
            .expect("expected OnIntent in state body");

        if let Statement::OnIntent { intent, body } = on_intent {
            assert_eq!(intent, "start");
            match body {
                IntentBody::Next(target) => assert_eq!(target, "done"),
                IntentBody::Block(_) => panic!("expected Next body, got Block"),
            }
        }
    }

    #[test]
    fn parse_intent_block_form_produces_block_body() {
        // intent block uses indentation (no braces)
        let src = "state s\n  goal \"S.\"\n  interact\n  on intent \"go\"\n    transition to t\n  on offtopic transition to s\n\nstate t\n  goal \"T.\"\n  interact\n  on intent \"stay\" transition to t\n  on offtopic transition to t\n";
        let bf = must_parse(src);
        let on_intent = bf.states[0].body.iter()
            .find(|s| matches!(s, Statement::OnIntent { .. }))
            .expect("expected OnIntent in state body");

        assert!(
            matches!(on_intent, Statement::OnIntent { body: IntentBody::Block(_), .. }),
            "expected Block body for block-form intent handler"
        );
    }

    #[test]
    fn parse_invalid_syntax_returns_error() {
        let result = parse_behavior("## definitely not valid behavior @@@ syntax ###");
        assert!(result.is_err());
        assert!(!result.unwrap_err().0.is_empty());
    }

    #[test]
    fn parse_empty_string_returns_error() {
        // The grammar requires at least one declaration; empty input is a syntax error.
        let result = parse_behavior("");
        assert!(result.is_err(), "empty string should be a parse error");
    }
}
