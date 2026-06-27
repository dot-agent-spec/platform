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

pub mod fsm;
pub mod memory;

use std::collections::{HashMap, HashSet};

use crate::effect::{Effect, MemValue};
use dot_agent_parser_dsl::{self as parser, ast::BehaviorFile, ParseError};
use fsm::Fsm;
use memory::MemoryStore;

pub struct AgentDSLKernel {
    fsm: Option<Fsm>,
    memory: MemoryStore,
    file_resolver: Option<Box<dyn Fn(&str) -> Option<String>>>,
}

impl AgentDSLKernel {
    pub fn new() -> Self {
        AgentDSLKernel { fsm: None, memory: MemoryStore::new(), file_resolver: None }
    }

    pub fn set_file_resolver(&mut self, resolver: Box<dyn Fn(&str) -> Option<String>>) {
        self.file_resolver = Some(resolver);
    }

    pub fn load_behavior(&mut self, text: &str) -> Result<Vec<Effect>, ParseError> {
        let behavior_file = parser::parse_behavior(text)?;
        let mut fsm = Fsm::new(behavior_file);
        let effects = fsm.enter_current_state(&mut self.memory);
        self.fsm = Some(fsm);
        Ok(effects)
    }

    pub fn load_behavior_with_bundle(
        &mut self,
        main_text: &str,
        bundle: &HashMap<String, String>,
    ) -> Result<Vec<Effect>, ParseError> {
        let behavior_file = parser::parse_behavior(main_text)?;
        let mut visited = HashSet::new();
        let flattened = self.flatten_merges(behavior_file, bundle, &mut visited)?;
        let mut fsm = Fsm::new(flattened);
        let effects = fsm.enter_current_state(&mut self.memory);
        self.fsm = Some(fsm);
        Ok(effects)
    }

    fn flatten_merges(
        &self,
        mut behavior: BehaviorFile,
        bundle: &HashMap<String, String>,
        visited: &mut HashSet<String>,
    ) -> Result<BehaviorFile, ParseError> {
        for path in std::mem::take(&mut behavior.merges) {
            if !visited.insert(path.clone()) {
                continue;
            }
            let content = bundle
                .get(&path)
                .cloned()
                .or_else(|| self.file_resolver.as_ref().and_then(|r| r(&path)));
            match content {
                Some(text) => {
                    let merged_bf = parser::parse_behavior(&text)?;
                    let merged_flat = self.flatten_merges(merged_bf, bundle, visited)?;
                    for state in merged_flat.states {
                        if !behavior.states.iter().any(|s| s.name == state.name) {
                            behavior.states.push(state);
                        }
                    }
                    for trigger in merged_flat.global_triggers {
                        behavior.global_triggers.push(trigger);
                    }
                }
                None => continue,
            }
        }
        Ok(behavior)
    }

    pub fn send_intent(&mut self, intent: &str) -> Vec<Effect> {
        match &mut self.fsm {
            Some(fsm) => fsm.send_intent(intent, &mut self.memory),
            None => vec![],
        }
    }

    pub fn send_offtopic(&mut self) -> Vec<Effect> {
        match &mut self.fsm {
            Some(fsm) => fsm.send_offtopic(&mut self.memory),
            None => vec![],
        }
    }


    pub fn send_event(&mut self, event: &str) -> Vec<Effect> {
        match &mut self.fsm {
            Some(fsm) => fsm.send_event(event, &mut self.memory),
            None => vec![],
        }
    }

    pub fn tick_prompt(&mut self) -> Vec<Effect> {
        match &mut self.fsm {
            Some(fsm) => fsm.tick_prompt(&mut self.memory),
            None => vec![],
        }
    }

    pub fn get_current_state(&self) -> String {
        self.fsm
            .as_ref()
            .map(|f| f.current_state.clone())
            .unwrap_or_default()
    }

    pub fn get_valid_intents(&self) -> Vec<String> {
        self.fsm
            .as_ref()
            .map(|f| f.get_valid_intents())
            .unwrap_or_default()
    }

    pub fn get_memory(&self) -> memory::StoreSnapshot {
        self.memory.snapshot()
    }

    pub fn set_memory(&mut self, domain: &str, key: &str, value: MemValue) {
        self.memory.set_raw(domain, key, value);
    }

    pub fn get_graph(&self) -> Option<String> {
        self.fsm.as_ref().map(|f| f.get_graph())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::effect::Effect;

    fn kernel_with(dsl: &str) -> AgentDSLKernel {
        let mut k = AgentDSLKernel::new();
        k.load_behavior(dsl).expect("DSL should parse");
        k
    }

    #[test]
    fn transition_to_ended_emits_effect_and_updates_state() {
        let dsl = "state greeting\n  interact\n  on intent \"done\" transition to ended\n";
        let mut k = kernel_with(dsl);

        let effects = k.send_intent("done");

        let transition = effects.iter().find(|e| matches!(e, Effect::Transition { .. }));
        assert!(transition.is_some(), "expected Transition effect");
        if let Some(Effect::Transition { from, to }) = transition {
            assert_eq!(from, "greeting");
            assert_eq!(to, "ended");
        }
        assert_eq!(k.get_current_state(), "ended");
    }

    #[test]
    fn transition_to_unknown_state_emits_nothing() {
        let dsl = "state greeting\n  interact\n  on intent \"go\" transition to nonexistent\n";
        let mut k = kernel_with(dsl);

        let effects = k.send_intent("go");

        let transition = effects.iter().find(|e| matches!(e, Effect::Transition { .. }));
        assert!(transition.is_none(), "unknown target must not emit Transition");
        assert_eq!(k.get_current_state(), "greeting", "state must not change");
    }

    // ── §1 merge runtime ──────────────────────────────────────────────────────

    const MAIN_DSL: &str = concat!(
        "merge \"shared.behavior\"\n",
        "state intro\n",
        "  interact\n",
        "  on intent \"next\" transition to detail\n",
    );

    const SHARED_DSL: &str = concat!(
        "state detail\n",
        "  interact\n",
        "  on intent \"done\" transition to ended\n",
    );

    #[test]
    fn mode_a_bundle_resolves_merge_and_transitions_to_merged_state() {
        let mut bundle = HashMap::new();
        bundle.insert("shared.behavior".to_string(), SHARED_DSL.to_string());

        let mut k = AgentDSLKernel::new();
        k.load_behavior_with_bundle(MAIN_DSL, &bundle).expect("should load");

        assert_eq!(k.get_current_state(), "intro");

        let effects = k.send_intent("next");
        let transition = effects.iter().find(|e| matches!(e, Effect::Transition { to, .. } if to == "detail"));
        assert!(transition.is_some(), "expected transition to 'detail' from merged file");
        assert_eq!(k.get_current_state(), "detail");

        let effects2 = k.send_intent("done");
        let t2 = effects2.iter().find(|e| matches!(e, Effect::Transition { to, .. } if to == "ended"));
        assert!(t2.is_some(), "expected transition to ended from merged state");
        assert_eq!(k.get_current_state(), "ended");
    }

    #[test]
    fn mode_b_resolver_fallback_resolves_merge_when_not_in_bundle() {
        let mut k = AgentDSLKernel::new();
        k.set_file_resolver(Box::new(|path: &str| {
            if path == "shared.behavior" { Some(SHARED_DSL.to_string()) } else { None }
        }));

        // Empty bundle — resolver must handle the path
        k.load_behavior_with_bundle(MAIN_DSL, &HashMap::new()).expect("should load via resolver");

        assert_eq!(k.get_current_state(), "intro");

        let effects = k.send_intent("next");
        let transition = effects.iter().find(|e| matches!(e, Effect::Transition { to, .. } if to == "detail"));
        assert!(transition.is_some(), "resolver must supply merged states");
        assert_eq!(k.get_current_state(), "detail");
    }

    #[test]
    fn merge_missing_path_is_silently_skipped() {
        let dsl = "merge \"nonexistent.behavior\"\nstate solo\n  interact\n";
        let mut k = AgentDSLKernel::new();
        // No bundle, no resolver — missing merge must not crash
        k.load_behavior_with_bundle(dsl, &HashMap::new()).expect("should not error on missing merge");
        assert_eq!(k.get_current_state(), "solo");
    }

    #[test]
    fn main_state_takes_precedence_over_merged_duplicate() {
        let shared = "state greeting\n  goal \"from shared\"\n";
        let main = concat!(
            "merge \"shared.behavior\"\n",
            "state greeting\n",
            "  goal \"from main\"\n",
            "  interact\n",
        );
        let mut bundle = HashMap::new();
        bundle.insert("shared.behavior".to_string(), shared.to_string());

        let mut k = AgentDSLKernel::new();
        let effects = k.load_behavior_with_bundle(main, &bundle).expect("should load");

        let goal_text: Vec<_> = effects.iter().filter_map(|e| {
            if let Effect::Goal { text } = e { Some(text.as_str()) } else { None }
        }).collect();
        assert_eq!(goal_text, ["from main"], "main file's state must shadow merged duplicate");
    }
}
