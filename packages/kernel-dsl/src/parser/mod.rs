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

pub mod ast;

use tree_sitter::{Parser, Node};
use serde_json::{Value, json, Map};

include!(concat!(env!("OUT_DIR"), "/node_kinds.rs"));

#[derive(Debug)]
pub struct ParseError(pub String);

pub fn parse_behavior(text: &str) -> Result<ast::BehaviorFile, ParseError> {
    let mut parser = Parser::new();
    parser.set_language(&dot_agent_tree_sitter::language_behavior())
        .map_err(|_| ParseError("Failed to load behavior language".to_string()))?;

    let tree = parser.parse(text, None)
        .ok_or_else(|| ParseError("Failed to parse behavior".to_string()))?;

    let root_node = tree.root_node();
    if root_node.has_error() {
        return Err(ParseError("Syntax error in behavior file".to_string()));
    }

    let value = node_to_value(root_node, text);
    serde_json::from_value(value)
        .map_err(|e| ParseError(format!("Failed to map tree to AST: {}", e)))
}

fn node_to_value(node: Node, source: &str) -> Value {
    let kind = node.kind();

    if node.child_count() == 0 || kind == "identifier" || kind == "quoted_string" || kind == "number_literal" || kind == "path" {
        let text = &source[node.byte_range()];
        if kind == "quoted_string" && text.starts_with('"') && text.ends_with('"') {
            return json!(text[1..text.len()-1].to_string());
        }
        return json!(text);
    }

    // Special handling for state_decl: flatten oriented/setup_state_body into body field
    // NOTE: state_decl is a wrapper, NOT a Statement variant — don't add "type" tag
    if kind == "state_decl" {
        let mut map = Map::new();

        if let Some(name_node) = node.child_by_field_name("name") {
            map.insert("name".to_string(), node_to_value(name_node, source));
        }

        // Extract body statements from either oriented_state_body or setup_state_body
        let mut body_statements = Vec::new();
        let mut cursor = node.walk();
        for child in node.named_children(&mut cursor) {
            if child.kind() == "oriented_state_body" || child.kind() == "setup_state_body" {
                body_statements.extend(extract_state_body_statements(child, source));
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

    // Special handling for trigger_decl: also not a Statement variant
    if kind == "trigger_decl" {
        let mut map = Map::new();

        if let Some(event_node) = node.child_by_field_name("event") {
            map.insert("event".to_string(), node_to_value(event_node, source));
        }

        let mut body_statements = Vec::new();
        if let Some(block_node) = node.child_by_field_name("block") {
            body_statements.extend(extract_handler_block_statements(block_node, source));
        }
        map.insert("body".to_string(), json!(body_statements));

        return Value::Object(map);
    }

    let mut map = Map::new();
    let mut type_name = kind.to_string();

    // Special handling for handlers with inline shorthand or event field
    match kind {
        "intent_trigger" => {
            if let Some(intent_node) = node.child_by_field_name("intent") {
                map.insert("intent".to_string(), node_to_value(intent_node, source));
            }

            if let Some(state_node) = node.child_by_field_name("state") {
                // inline form: on intent "..." transition to X
                let state_val = node_to_value(state_node, source);
                map.insert("body".to_string(), state_val);
            } else if let Some(block_node) = node.child_by_field_name("block") {
                // block form: on intent "..." {...}
                let body_stmts = extract_handler_block_statements(block_node, source);
                map.insert("body".to_string(), json!(body_stmts));
            }
        }
        "offtopic_stmt" => {
            if let Some(state_node) = node.child_by_field_name("state") {
                // inline form: on offtopic transition to X
                // Emit as array with a Transition statement
                let target_str = &source[state_node.byte_range()];
                let transition = json!({
                    "type": "transition_stmt",
                    "state": target_str
                });
                map.insert("body".to_string(), json!(vec![transition]));
            } else if let Some(block_node) = node.child_by_field_name("block") {
                let body_stmts = extract_handler_block_statements(block_node, source);
                map.insert("body".to_string(), json!(body_stmts));
            }
        }
        "fallback_stmt" => {
            if let Some(state_node) = node.child_by_field_name("state") {
                // inline form: on fallback transition to X
                // Emit as array with a Transition statement
                let target_str = &source[state_node.byte_range()];
                let transition = json!({
                    "type": "transition_stmt",
                    "state": target_str
                });
                map.insert("body".to_string(), json!(vec![transition]));
            } else if let Some(block_node) = node.child_by_field_name("block") {
                let body_stmts = extract_handler_block_statements(block_node, source);
                map.insert("body".to_string(), json!(body_stmts));
            }
        }
        "parallel_trigger" | "parallel_trigger_restricted" => {
            // Read event field (choice of 'complete' or 'failed')
            if let Some(event_node) = node.child_by_field_name("event") {
                let event_text = &source[event_node.byte_range()];
                type_name = if event_text == "complete" {
                    "on_complete_stmt".to_string()
                } else {
                    "on_failed_stmt".to_string()
                };
            }

            if let Some(block_node) = node.child_by_field_name("block") {
                let body_stmts = extract_handler_block_statements(block_node, source);
                map.insert("body".to_string(), json!(body_stmts));
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

            // Add unnamed named children to "body" if they exist and the node is a block-like
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
