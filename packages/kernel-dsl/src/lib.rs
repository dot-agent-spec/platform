// SPDX-License-Identifier: Apache-2.0

//! **Not published to crates.io, by design.** This crate depends on `wasm-bindgen` without a
//! `#[cfg(target_arch = "wasm32")]` gate and exports `#[wasm_bindgen]` items directly, so a
//! native (non-wasm) consumer would get a crate that either fails to build or ships a useless
//! API. It links `dot-agent-parser-dsl` and `dot-agent-tree-sitter` as path/rlib dependencies and
//! compiles to `cdylib` for the npm-distributed WASM build (`pkg/`). Publishing natively would
//! require first extracting a wasm-bindgen-free core crate — real work, not a CI checkbox.

// Public so the rlib half of this crate (integration tests, and any native embedder built from a
// checkout) can reach the engine and the effect payloads. The wasm-bindgen surface below stays the
// only thing JavaScript sees.
pub mod effect;
pub mod engine;

use std::collections::BTreeMap;
use engine::AgentDSLKernel as Inner;
use js_sys::Function;
use wasm_bindgen::prelude::*;

use crate::effect::{Effect, MemValue};

#[wasm_bindgen]
pub struct AgentDSLKernel {
    inner: Inner,
    observer: Option<Function>,
}

impl AgentDSLKernel {
    /// Call the registered observer once for each effect.
    fn dispatch(&self, effects: &[Effect]) {
        if let Some(ref cb) = self.observer {
            for effect in effects {
                if let Ok(val) = serde_wasm_bindgen::to_value(effect) {
                    let _ = cb.call1(&JsValue::NULL, &val);
                }
            }
        }
    }
}

#[wasm_bindgen]
impl AgentDSLKernel {
    #[wasm_bindgen(constructor)]
    pub fn new() -> AgentDSLKernel {
        AgentDSLKernel { inner: Inner::new(), observer: None }
    }

    /// Register a callback that WASM will call once per Effect as they are produced.
    ///
    /// This is the primary integration point — the equivalent of the importObject in a
    /// raw WebAssembly.instantiate call. The callback receives a single Effect object
    /// per invocation and must implement all WASM→JS directives (goal, guide, teach,
    /// run_script, run_subagent, run_tool, apply_css, …).
    ///
    /// Only one observer can be active at a time; calling observe() again replaces it.
    pub fn observe(&mut self, callback: Function) {
        self.observer = Some(callback);
    }

    /// Parse and load a .behavior DSL text.
    ///
    /// Fires the observer for each entry effect of the first state (typically goal +
    /// request_interact). Also returns the effects array for imperative call sites.
    /// On parse error, fires and returns a single ParseError effect.
    pub fn load_behavior(&mut self, text: &str) -> String {
        let effects = match self.inner.load_behavior(text) {
            Ok(fx) => fx,
            Err(e) => vec![Effect::ParseError { message: e.0 }],
        };
        serde_json::to_string(&effects).unwrap_or_else(|_| "[]".to_string())
    }

    /// Register a synchronous fallback for resolving a file path the kernel was not handed.
    ///
    /// The callback receives a path string and must return the file content as a string, or
    /// null/undefined if the path cannot be resolved. It is called for two things:
    ///
    /// - a `merge "…"` path absent from the bundle given to `load_behavior_with_bundle` — the
    ///   original use, and the only one where returning nothing fails the load;
    /// - a `teach "…"` / `guide "…"` path absent from the map given to `set_content_files`, whose
    ///   miss is not an error and simply leaves `content: null`.
    ///
    /// For the `teach`/`guide` case, the path is normalized the way the packer normalizes it before
    /// bundling (a leading `./` stripped, `\` converted to `/`), so what arrives here is the bundle
    /// key, not necessarily the literal argument; inline prose never reaches the callback, since only
    /// text ending in `.txt`/`.md` — the packer's own test for a file reference — is offered to it.
    /// The `merge` case gets neither guarantee: `flatten_merges` passes the `merge "…"` argument
    /// exactly as written in the DSL, unnormalized and with no extension filter.
    pub fn set_file_resolver(&mut self, callback: Function) {
        use std::rc::Rc;
        let cb = Rc::new(callback);
        self.inner.set_file_resolver(Box::new(move |path: &str| {
            cb.call1(&JsValue::NULL, &JsValue::from_str(path))
                .ok()
                .and_then(|v| v.as_string())
        }));
    }

    /// Hand the kernel the knowledge and guide files, so `teach`/`guide` effects carry content.
    ///
    /// `files_json` must be a JSON object mapping bundle paths to their contents, e.g.
    /// `{"knowledge/cars.md": "# Cars\n…", "guides/intro.md": "…"}`. A `teach "knowledge/cars.md"`
    /// then arrives with `content` filled in beside the unchanged `text`. The key is the reference
    /// normalized the way the packer normalizes it — a leading `./` stripped, `\` converted to `/`
    /// — and the match on it is exact, so inline prose and unbundled paths arrive with
    /// `content: null`.
    ///
    /// Optional. A host that prefers to fetch lazily — handing the path on to its own resource
    /// layer — skips this call and keeps receiving bare paths, at no payload cost.
    pub fn set_content_files(&mut self, files_json: &str) {
        let files: BTreeMap<String, String> = serde_json::from_str(files_json).unwrap_or_default();
        self.inner.set_content_files(files);
    }

    /// Parse and load a .behavior DSL text, resolving `merge "…"` paths from a pre-built bundle.
    ///
    /// `bundle_json` must be a JSON object mapping path strings to their file contents,
    /// e.g. `{"agent.behavior": "state s1\n…", "shared/helpers.behavior": "state s2\n…"}`.
    /// Paths not found in the bundle fall through to the resolver registered via `set_file_resolver`.
    /// Returns effects JSON identical to `load_behavior`.
    pub fn load_behavior_with_bundle(&mut self, main_text: &str, bundle_json: &str) -> String {
        let bundle: BTreeMap<String, String> =
            serde_json::from_str(bundle_json).unwrap_or_default();
        let effects = match self.inner.load_behavior_with_bundle(main_text, &bundle) {
            Ok(fx) => fx,
            Err(e) => vec![Effect::ParseError { message: e.0 }],
        };
        serde_json::to_string(&effects).unwrap_or_else(|_| "[]".to_string())
    }

    /// Dispatch a named intent to the FSM.
    ///
    /// Call this after the LLM classifies the user's message into an intent name that
    /// matches one of the `on intent "…"` declarations in the current state.
    /// Fires the observer with transition + any entry effects of the new state.
    pub fn send_intent(&mut self, intent: &str) -> String {
        let effects = self.inner.send_intent(intent);
        serde_json::to_string(&effects).unwrap_or_else(|_| "[]".to_string())
    }

    /// Signal that the current message is off-topic.
    ///
    /// Fires the observer with the effects of the current state's `on offtopic` block.
    pub fn send_offtopic(&mut self) -> String {
        let effects = self.inner.send_offtopic();
        serde_json::to_string(&effects).unwrap_or_else(|_| "[]".to_string())
    }

    /// Dispatch a named global event (e.g. "session.ended", "script.done").
    ///
    /// Matches top-level `on event "…"` declarations. Use this to notify the FSM
    /// when an async operation triggered by run_script / run_subagent / run_tool completes.
    pub fn send_event(&mut self, event: &str) -> String {
        let effects = self.inner.send_event(event);
        serde_json::to_string(&effects).unwrap_or_else(|_| "[]".to_string())
    }

    /// Notify the engine that a prompt turn was processed.
    ///
    /// Call once per LLM completion. Triggers any matching `after N prompts` handlers
    /// in the current state, firing their effects through the observer.
    pub fn tick_prompt(&mut self) -> String {
        let effects = self.inner.tick_prompt();
        serde_json::to_string(&effects).unwrap_or_else(|_| "[]".to_string())
    }

    /// Return the name of the current state.
    pub fn get_current_state(&self) -> String {
        self.inner.get_current_state()
    }

    /// Return an array of intent strings declared in the current state.
    ///
    /// Use this to build the list of valid intent names to pass to the LLM classifier.
    pub fn get_valid_intents(&self) -> js_sys::Array {
        let intents = self.inner.get_valid_intents();
        let array = js_sys::Array::new();
        for intent in intents {
            array.push(&JsValue::from_str(&intent));
        }
        array
    }

    /// Return the full memory store as a JSON array of { domain, key, value } entries.
    pub fn get_memory(&self) -> String {
        let snapshot = self.inner.get_memory();
        serde_json::to_string(&snapshot).unwrap_or_else(|_| "[]".to_string())
    }

    /// Set a value in the memory store from JS.
    ///
    /// domain: "context" | "session" | "worksession" | "user"
    /// value_json: value serialized as a JSON primitive ("text", 42, true, null)
    pub fn set_memory(&mut self, domain: &str, key: &str, value_json: &str) {
        let mem_value = parse_json_primitive(value_json);
        self.inner.set_memory(domain, key, mem_value);
    }

    /// Serialize the FSM position as compact JSON, for storage between interactions.
    ///
    /// Shape: `{"v":1,"behavior":"9f2c…","state":"booking","prompt_count":3}`. The counter
    /// travels with the state name because `after N prompts` handlers fire off it, and a
    /// transition zeroes it. `behavior` fingerprints the loaded behavior's state graph, so a
    /// blob cannot be restored into a different agent that happens to reuse a state name.
    ///
    /// The blob **excludes memory** — that half is the runtime's, and it already has its own
    /// pair in `get_memory` / `set_memory`. Restore with `restore_state`.
    pub fn serialize_state(&self) -> String {
        self.inner.serialize_state_json()
    }

    /// Reposition the FSM from a blob produced by `serialize_state`, firing no entry effects.
    ///
    /// Throws when the blob is malformed, carries a version this kernel does not read, was
    /// taken from a different behavior, names a state the loaded behavior does not declare, or
    /// when no behavior has been loaded yet. A rejected restore leaves the kernel exactly
    /// where it stood — it never half-applies.
    ///
    /// **Load first, then restore, and drop what the load emits.** This call requires a loaded
    /// behavior, and `load_behavior` enters the init state — so its entry effects reach the
    /// observer before the position is corrected, and describe a state the session has already
    /// left. The rehydration sequence is `load_behavior` → discard its effects →
    /// `restore_state` → `set_memory` → `send_intent`.
    pub fn restore_state(&mut self, state_json: &str) -> Result<(), JsError> {
        self.inner.restore_state_json(state_json).map_err(|e| JsError::new(&e))
    }

    /// Return the state graph as SCXML (W3C https://www.w3.org/TR/scxml/) with
    /// `_active="true"` on the current state element.
    ///
    /// Use this to render the Flow Graph panel in VS Code or any diagram tool.
    /// For the static variant without runtime annotation, use the behavior-parser's get_graph().
    pub fn get_graph(&self) -> String {
        self.inner.get_graph().unwrap_or_default()
    }
}

fn parse_json_primitive(s: &str) -> MemValue {
    let trimmed = s.trim();
    if trimmed == "null"  { return MemValue::Null; }
    if trimmed == "true"  { return MemValue::Bool(true); }
    if trimmed == "false" { return MemValue::Bool(false); }
    if let Ok(n) = trimmed.parse::<f64>() { return MemValue::Num(n); }
    if trimmed.starts_with('"') && trimmed.ends_with('"') && trimmed.len() >= 2 {
        return MemValue::Str(trimmed[1..trimmed.len() - 1].to_string());
    }
    MemValue::Str(trimmed.to_string())
}
