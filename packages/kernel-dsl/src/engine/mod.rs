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

use crate::effect::{Effect, MemValue};
use dot_agent_parser_dsl::{self as parser, ParseError};
use fsm::Fsm;
use memory::MemoryStore;

pub struct AgentDSLKernel {
    fsm: Option<Fsm>,
    memory: MemoryStore,
}

impl AgentDSLKernel {
    pub fn new() -> Self {
        AgentDSLKernel { fsm: None, memory: MemoryStore::new() }
    }

    pub fn load_behavior(&mut self, text: &str) -> Result<Vec<Effect>, ParseError> {
        let behavior_file = parser::parse_behavior(text)?;
        let mut fsm = Fsm::new(behavior_file);
        let effects = fsm.enter_current_state(&mut self.memory);
        self.fsm = Some(fsm);
        Ok(effects)
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
