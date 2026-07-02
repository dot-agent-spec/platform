// Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0

//! **Not published to crates.io, by design.** This crate depends on `wasm-bindgen` without a
//! `#[cfg(target_arch = "wasm32")]` gate and exports `#[wasm_bindgen]` items directly, so a
//! native (non-wasm) consumer would get a crate that either fails to build or ships a useless
//! API. It's consumed today only as a path dependency (`dot-agent-kernel-dsl` links it as an
//! rlib) and compiled to `cdylib` for the npm-distributed WASM build. Publishing natively would
//! require first extracting a wasm-bindgen-free core crate — real work, not a CI checkbox. See
//! `dot-agent-spec/project/tasks/DA01-01-update-version-and-packages.md` item 7.

pub mod ast;
mod parser;
mod analysis;
mod description_parser;

// Re-export for rlib consumers (kernel-dsl links these directly).
pub use parser::{parse_behavior, ParseError};
pub use description_parser::parse_description;

use wasm_bindgen::prelude::*;

/// Parse a .behavior source text.
///
/// New JSON contract (breaking change from DA01-01):
/// - Success, no issues:  `{ "ok": BehaviorFile, "diagnostics": [] }`
/// - Success with errors: `{ "ok": BehaviorFile, "diagnostics": [ParseDiagnostic, ...] }`
/// - Parse failure:       `{ "ok": null,         "diagnostics": [ParseDiagnostic, ...] }`
#[wasm_bindgen(js_name = "parse_behavior")]
pub fn wasm_parse_behavior(text: &str) -> String {
    let (ok, diags) = parser::parse_behavior_with_diagnostics(text);
    serde_json::json!({ "ok": ok, "diagnostics": diags }).to_string()
}

/// Parse a .description source text.
///
/// Same contract as parse_behavior:
/// - Success:  `{ "ok": DescriptionFile, "diagnostics": [] }`
/// - Failure:  `{ "ok": null,            "diagnostics": [ParseDiagnostic, ...] }`
#[wasm_bindgen(js_name = "parse_description")]
pub fn wasm_parse_description(text: &str) -> String {
    let (ok, diags) = description_parser::parse_description_with_diagnostics(text);
    serde_json::json!({ "ok": ok, "diagnostics": diags }).to_string()
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
