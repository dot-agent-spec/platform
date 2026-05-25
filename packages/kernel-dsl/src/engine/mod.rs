pub mod fsm;
pub mod memory;

use crate::effect::{Effect, MemValue};
use crate::parser::{self, ParseError};
use fsm::Fsm;
use memory::MemoryStore;

pub struct FlowEngine {
    fsm: Option<Fsm>,
    memory: MemoryStore,
}

impl FlowEngine {
    pub fn new() -> Self {
        FlowEngine { fsm: None, memory: MemoryStore::new() }
    }

    pub fn load_flow(&mut self, text: &str) -> Result<Vec<Effect>, ParseError> {
        let flow_file = parser::parse_flow(text)?;
        let mut fsm = Fsm::new(flow_file);
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

    pub fn send_escape(&mut self) -> Vec<Effect> {
        match &mut self.fsm {
            Some(fsm) => fsm.send_escape(&mut self.memory),
            None => vec![],
        }
    }

    pub fn send_fallback(&mut self) -> Vec<Effect> {
        match &mut self.fsm {
            Some(fsm) => fsm.send_fallback(&mut self.memory),
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

    pub fn get_graph(&self) -> Option<fsm::GraphInfo> {
        self.fsm.as_ref().map(|f| f.get_graph())
    }
}
