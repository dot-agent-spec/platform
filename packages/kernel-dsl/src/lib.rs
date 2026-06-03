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

mod effect;
mod engine;
pub mod parser;

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
    pub fn load_behavior(&mut self, text: &str) -> JsValue {
        let effects = match self.inner.load_behavior(text) {
            Ok(fx) => fx,
            Err(e) => vec![Effect::ParseError { message: e.0 }],
        };
        self.dispatch(&effects);
        serde_wasm_bindgen::to_value(&effects).unwrap_or(JsValue::NULL)
    }

    /// Dispatch a named intent to the FSM.
    ///
    /// Call this after the LLM classifies the user's message into an intent name that
    /// matches one of the `on intent "…"` declarations in the current state.
    /// Fires the observer with transition + any entry effects of the new state.
    pub fn send_intent(&mut self, intent: &str) -> JsValue {
        let effects = self.inner.send_intent(intent);
        self.dispatch(&effects);
        serde_wasm_bindgen::to_value(&effects).unwrap_or(JsValue::NULL)
    }

    /// Signal that the current message is off-topic.
    ///
    /// Fires the observer with the effects of the current state's `on offtopic` block.
    pub fn send_offtopic(&mut self) -> JsValue {
        let effects = self.inner.send_offtopic();
        self.dispatch(&effects);
        serde_wasm_bindgen::to_value(&effects).unwrap_or(JsValue::NULL)
    }

    /// Signal that the runtime could not resolve the current action.

    /// Dispatch a named global event (e.g. "session.ended", "script.done").
    ///
    /// Matches top-level `on event "…"` declarations. Use this to notify the FSM
    /// when an async operation triggered by run_script / run_subagent / run_tool completes.
    pub fn send_event(&mut self, event: &str) -> JsValue {
        let effects = self.inner.send_event(event);
        self.dispatch(&effects);
        serde_wasm_bindgen::to_value(&effects).unwrap_or(JsValue::NULL)
    }

    /// Notify the engine that a prompt turn was processed.
    ///
    /// Call once per LLM completion. Triggers any matching `after N prompts` handlers
    /// in the current state, firing their effects through the observer.
    pub fn tick_prompt(&mut self) -> JsValue {
        let effects = self.inner.tick_prompt();
        self.dispatch(&effects);
        serde_wasm_bindgen::to_value(&effects).unwrap_or(JsValue::NULL)
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
    pub fn get_memory(&self) -> JsValue {
        let snapshot = self.inner.get_memory();
        serde_wasm_bindgen::to_value(&snapshot).unwrap_or(JsValue::NULL)
    }

    /// Set a value in the memory store from JS.
    ///
    /// domain: "context" | "session" | "worksession" | "user"
    /// value_json: value serialized as a JSON primitive ("text", 42, true, null)
    pub fn set_memory(&mut self, domain: &str, key: &str, value_json: &str) {
        let mem_value = parse_json_primitive(value_json);
        self.inner.set_memory(domain, key, mem_value);
    }

    /// Signal that the last async operation (run_script, run_subagent, run_tool) completed successfully.
    ///
    /// Fires the observer with the effects of the current state's `on complete` block.
    pub fn send_complete(&mut self) -> JsValue {
        let effects = self.inner.send_complete();
        self.dispatch(&effects);
        serde_wasm_bindgen::to_value(&effects).unwrap_or(JsValue::NULL)
    }

    /// Signal that the last async operation (run_script, run_subagent, run_tool) failed.
    ///
    /// Fires the observer with the effects of the current state's `on failed` block.
    pub fn send_failed(&mut self) -> JsValue {
        let effects = self.inner.send_failed();
        self.dispatch(&effects);
        serde_wasm_bindgen::to_value(&effects).unwrap_or(JsValue::NULL)
    }

    /// Return the state graph as { states, transitions, current }.
    ///
    /// Use this to render the Flow Graph panel in VS Code or any diagram tool.
    pub fn get_graph(&self) -> JsValue {
        match self.inner.get_graph() {
            Some(graph) => serde_wasm_bindgen::to_value(&graph).unwrap_or(JsValue::NULL),
            None => JsValue::NULL,
        }
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
