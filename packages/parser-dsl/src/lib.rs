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
mod parser;
mod analysis;

pub use parser::{parse_behavior, ParseError};

use wasm_bindgen::prelude::*;

/// Parse a .behavior source text.
/// Returns JSON: `{ "ok": FSMDefinition }` on success, `{ "error": "..." }` on failure.
/// FSMDefinition is the JSON representation of BehaviorFile.
#[wasm_bindgen]
pub fn parse(text: &str) -> String {
    match parser::parse_behavior(text) {
        Ok(behavior) => {
            let result = serde_json::json!({ "ok": behavior });
            result.to_string()
        }
        Err(ParseError(msg)) => {
            let result = serde_json::json!({ "error": msg });
            result.to_string()
        }
    }
}

/// Generate a static FSM graph as SCXML (W3C https://www.w3.org/TR/scxml/).
/// No _active annotation — call the kernel's get_graph() for runtime state.
/// Returns empty string on parse error.
/// Anticipated by RFC-0004.
#[wasm_bindgen]
pub fn get_graph(text: &str) -> String {
    match parser::parse_behavior(text) {
        Ok(behavior) => analysis::to_scxml(&behavior),
        Err(_) => String::new(),
    }
}

/// List of state names declared in the behavior, in declaration order.
/// Returns JSON-encoded String[].
/// Anticipated by RFC-0004.
#[wasm_bindgen]
pub fn get_states(text: &str) -> String {
    match parser::parse_behavior(text) {
        Ok(behavior) => {
            let states = analysis::list_states(&behavior);
            serde_json::to_string(&states).unwrap_or_else(|_| "[]".to_string())
        }
        Err(_) => "[]".to_string(),
    }
}

/// List of intents valid in a specific state (from its interact block).
/// Returns JSON-encoded String[]. Empty array if state not found or has no interact.
/// Anticipated by RFC-0004 (static variant of the kernel's get_valid_intents()).
#[wasm_bindgen]
pub fn get_intents_for_state(text: &str, state_name: &str) -> String {
    match parser::parse_behavior(text) {
        Ok(behavior) => {
            let intents = analysis::intents_for_state(&behavior, state_name);
            serde_json::to_string(&intents).unwrap_or_else(|_| "[]".to_string())
        }
        Err(_) => "[]".to_string(),
    }
}
