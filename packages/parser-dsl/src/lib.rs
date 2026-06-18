// Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0

pub mod ast;
mod parser;
mod analysis;
mod description_parser;

// Re-export for rlib consumers (kernel-dsl links these directly).
pub use parser::{parse_behavior, ParseError};
pub use description_parser::parse_description;

use wasm_bindgen::prelude::*;

/// Parse a .behavior source text.
/// Returns JSON: `{ "ok": BehaviorFile }` on success, `{ "error": "..." }` on failure.
/// js_name keeps the WASM export as `parse_behavior` while the Rust name avoids collision.
#[wasm_bindgen(js_name = "parse_behavior")]
pub fn wasm_parse_behavior(text: &str) -> String {
    match parser::parse_behavior(text) {
        Ok(behavior) => serde_json::json!({ "ok": behavior }).to_string(),
        Err(ParseError(msg)) => serde_json::json!({ "error": msg }).to_string(),
    }
}

/// Parse a .description source text.
/// Returns JSON: `{ "ok": DescriptionFile }` on success, `{ "error": "..." }` on failure.
#[wasm_bindgen(js_name = "parse_description")]
pub fn wasm_parse_description(text: &str) -> String {
    match description_parser::parse_description(text) {
        Ok(df) => serde_json::json!({ "ok": df }).to_string(),
        Err(ParseError(msg)) => serde_json::json!({ "error": msg }).to_string(),
    }
}

/// Generate a static FSM graph as SCXML (W3C https://www.w3.org/TR/scxml/).
/// No _active annotation — call the kernel's get_graph() for runtime state.
/// Returns empty string on parse error.
#[wasm_bindgen]
pub fn get_graph(text: &str) -> String {
    match parser::parse_behavior(text) {
        Ok(behavior) => analysis::to_scxml(&behavior),
        Err(_) => String::new(),
    }
}

/// List of state names declared in the behavior, in declaration order.
/// Returns JSON-encoded String[].
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
