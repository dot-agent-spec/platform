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

use dot_agent_tree_sitter::NODE_TYPES_BEHAVIOR;
use serde_json::Value;
use std::{env, fs, path::Path};

fn main() {
    let out_dir = env::var("OUT_DIR").unwrap();
    let dest = Path::new(&out_dir).join("node_kinds.rs");

    let nodes: Vec<Value> = serde_json::from_str(NODE_TYPES_BEHAVIOR)
        .expect("Failed to parse NODE_TYPES_BEHAVIOR as JSON");

    let statement_kinds = children_of(&nodes, "statement");
    let handler_kinds = children_of(&nodes, "handler_block");
    let state_body_kinds = {
        let mut v = children_of(&nodes, "oriented_state_body");
        v.extend(children_of(&nodes, "setup_state_body"));
        v.sort();
        v.dedup();
        v
    };
    let restricted_block_kinds = children_of(&nodes, "restricted_block");

    let code = format!(
        r#"
// AUTO-GENERATED: do not edit. Regenerated from tree-sitter grammar node-types.json

pub const STATEMENT_KINDS: &[&str] = &[{stmt}];
pub const HANDLER_BLOCK_KINDS: &[&str] = &[{handler}];
pub const STATE_BODY_KINDS: &[&str] = &[{state}];
pub const RESTRICTED_BLOCK_KINDS: &[&str] = &[{restricted}];

pub fn is_statement_kind(kind: &str) -> bool {{
    STATEMENT_KINDS.contains(&kind)
}}

pub fn is_handler_block_kind(kind: &str) -> bool {{
    HANDLER_BLOCK_KINDS.contains(&kind)
}}

pub fn is_state_body_kind(kind: &str) -> bool {{
    STATE_BODY_KINDS.contains(&kind)
}}

pub fn is_restricted_block_kind(kind: &str) -> bool {{
    RESTRICTED_BLOCK_KINDS.contains(&kind)
}}
"#,
        stmt = to_str_list(&statement_kinds),
        handler = to_str_list(&handler_kinds),
        state = to_str_list(&state_body_kinds),
        restricted = to_str_list(&restricted_block_kinds),
    );

    fs::write(&dest, code).expect("Failed to write generated node_kinds.rs");
    println!("cargo:rerun-if-changed=build.rs");
}

fn children_of(nodes: &[Value], parent_type: &str) -> Vec<String> {
    nodes
        .iter()
        .filter(|n| n["type"] == parent_type && n["named"] == true)
        .flat_map(|n| {
            n["children"]["types"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .filter(|t| t["named"] == true)
                .filter_map(|t| t["type"].as_str().map(|s| s.to_string()))
                .collect::<Vec<_>>()
        })
        .collect()
}

fn to_str_list(kinds: &[String]) -> String {
    kinds
        .iter()
        .map(|k| format!("\"{}\"", k))
        .collect::<Vec<_>>()
        .join(", ")
}
