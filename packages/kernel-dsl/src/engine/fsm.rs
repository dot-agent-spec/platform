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

use std::collections::BTreeMap;

use crate::effect::{Effect, MemValue};
use crate::engine::memory::MemoryStore;
use dot_agent_parser_dsl::{ast::*, ParseError};

const NATIVE_STATES: &[&str] = &["ended"];

pub struct Fsm {
    // Ordered list of state names (for SCXML output ordering).
    state_order: Vec<String>,
    states: BTreeMap<String, StateDef>,
    global_triggers: Vec<TriggerDecl>,
    pub current_state: String,
    pub prompt_count: u32,
}

impl Fsm {
    pub fn new(behavior: BehaviorFile) -> Result<Self, ParseError> {
        let state_order: Vec<String> = behavior.states.iter().map(|s| s.name.clone()).collect();
        let states: BTreeMap<String, StateDef> = behavior
            .states
            .into_iter()
            .map(|s| (s.name.clone(), s))
            .collect();

        if !states.contains_key("init") {
            return Err(ParseError(
                "E016: 'init' state not found — every behavior must declare a state named 'init'".to_string(),
            ));
        }

        Ok(Fsm {
            state_order,
            states,
            global_triggers: behavior.global_triggers,
            current_state: "init".to_string(),
            prompt_count: 0,
        })
    }

    // Enter the current state and return initial effects.
    pub fn enter_current_state(&mut self, mem: &mut MemoryStore) -> Vec<Effect> {
        let name = self.current_state.clone();
        if let Some(state) = self.states.get(&name).cloned() {
            self.exec_entry_statements(&state.body, mem)
        } else {
            vec![]
        }
    }

    // Exec only the non-handler statements at entry (goal, guide, teach, interact, run, set, if, apply, remove).
    fn exec_entry_statements(&mut self, stmts: &[Statement], mem: &mut MemoryStore) -> Vec<Effect> {
        let mut effects = Vec::new();
        for stmt in stmts {
            match stmt {
                Statement::Goal { .. }
                | Statement::Guide { .. }
                | Statement::Teach { .. }
                | Statement::Interact { .. }
                | Statement::Run(_)
                | Statement::Set { .. }
                | Statement::If { .. }
                | Statement::Apply { .. }
                | Statement::Remove { .. }
                | Statement::Parallel { .. } => {
                    effects.extend(self.exec_single(stmt, mem));
                }
                // handlers and transition are not auto-executed at entry
                _ => {}
            }
        }
        effects
    }

    pub fn send_intent(&mut self, intent: &str, mem: &mut MemoryStore) -> Vec<Effect> {
        let name = self.current_state.clone();
        if let Some(state) = self.states.get(&name).cloned() {
            for stmt in &state.body {
                if let Statement::OnIntent { intent: i, body } = stmt {
                    if i == intent {
                        return match body {
                            IntentBody::Next(target) => {
                                let mut fx = self.transition_to(target, mem);
                                fx.extend(self.enter_current_state(mem));
                                fx
                            }
                            IntentBody::Block(stmts) => {
                                self.exec_statements(stmts, mem)
                            }
                        };
                    }
                }
            }
        }
        vec![]
    }

    pub fn send_offtopic(&mut self, mem: &mut MemoryStore) -> Vec<Effect> {
        let name = self.current_state.clone();
        if let Some(state) = self.states.get(&name).cloned() {
            for stmt in &state.body {
                if let Statement::OnOfftopic { body: stmts } = stmt {
                    return self.exec_statements(stmts, mem);
                }
            }
        }
        vec![]
    }


    pub fn send_event(&mut self, event: &str, mem: &mut MemoryStore) -> Vec<Effect> {
        let mut effects = Vec::new();
        let triggers = self.global_triggers.clone();
        for trigger in &triggers {
            if trigger.event == event {
                effects.extend(self.exec_statements(&trigger.body.clone(), mem));
            }
        }
        effects
    }

    pub fn tick_prompt(&mut self, mem: &mut MemoryStore) -> Vec<Effect> {
        self.prompt_count += 1;
        let count = self.prompt_count;
        let name = self.current_state.clone();
        let mut effects = Vec::new();
        if let Some(state) = self.states.get(&name).cloned() {
            for stmt in &state.body {
                if let Statement::After { prompts, body } = stmt {
                    if count == *prompts {
                        effects.extend(self.exec_statements(body, mem));
                    }
                }
            }
        }
        effects
    }

    fn transition_to(&mut self, target: &str, _mem: &mut MemoryStore) -> Vec<Effect> {
        let from = self.current_state.clone();
        if self.states.contains_key(target) || NATIVE_STATES.contains(&target) {
            self.current_state = target.to_string();
            self.prompt_count = 0;
            vec![Effect::Transition { from, to: target.to_string() }]
        } else {
            vec![]
        }
    }

    fn exec_statements(&mut self, stmts: &[Statement], mem: &mut MemoryStore) -> Vec<Effect> {
        let stmts = stmts.to_vec();
        let mut effects = Vec::new();
        for stmt in &stmts {
            effects.extend(self.exec_single(stmt, mem));
        }
        effects
    }

    fn exec_single(&mut self, stmt: &Statement, mem: &mut MemoryStore) -> Vec<Effect> {
        match stmt {
            Statement::Goal { text } => vec![Effect::Goal { text: text.clone() }],

            Statement::Guide { text } => vec![Effect::Guide { text: text.clone() }],

            Statement::Teach { text } => vec![Effect::Teach { text: text.clone() }],

            Statement::Interact { handlers: _ } => {
                vec![Effect::RequestInteract]
            }

            Statement::Transition { target } => {
                let target = target.clone();
                let mut fx = self.transition_to(&target, mem);
                fx.extend(self.enter_current_state(mem));
                fx
            }

            Statement::Run(r) => {
                let mut fx = Vec::new();
                match r.kind {
                    RunKind::Script => fx.push(Effect::RunScript {
                        target: r.target.clone(),
                        parameters: r.parameters.clone(),
                        silent: matches!(r.modifier, Some(RunModifier::Silent)),
                    }),
                    RunKind::Subagent => fx.push(Effect::RunSubagent {
                        target: r.target.clone(),
                        parameters: r.parameters.clone(),
                        background: matches!(r.modifier, Some(RunModifier::Background)),
                    }),
                    RunKind::Tool => fx.push(Effect::RunTool {
                        target: r.target.clone(),
                        parameters: r.parameters.clone(),
                    }),
                }
                fx
            }

            Statement::Set { path, op, value } => {
                let mem_val = match value {
                    Expr::Value(v) => mem.resolve_value(v),
                    Expr::Compare { left, op: cmp_op, right } => {
                        let l = mem.resolve_value(left);
                        let r = mem.resolve_value(right);
                        MemValue::Bool(eval_compare(&l, cmp_op, &r))
                    }
                };
                let effect = Effect::SetMemory {
                    domain: path.domain.as_str().to_string(),
                    key: path.key.clone(),
                    value: mem_val.clone(),
                };
                mem.set(path, op, mem_val);
                vec![effect]
            }

            Statement::If { condition, then_body, else_body } => {
                let cond_result = self.eval_condition(condition, mem);
                if cond_result {
                    self.exec_statements(then_body, mem)
                } else if let Some(else_stmts) = else_body {
                    self.exec_statements(else_stmts, mem)
                } else {
                    vec![]
                }
            }

            Statement::Apply { value, .. } => {
                vec![Effect::ApplyCss { value: value.clone() }]
            }

            Statement::Remove { value, .. } => {
                vec![Effect::RemoveCss { value: value.clone() }]
            }

            Statement::Parallel { body, on_failure: _ } => {
                // Parallel tasks — execute sequentially for now (WASM is single-threaded).
                self.exec_statements(body, mem)
            }

            Statement::OnIntent { .. }
            | Statement::OnOfftopic { .. }
            | Statement::After { .. } => {
                // handlers — not directly executed, dispatched by send_*
                vec![]
            }
        }
    }

    fn eval_condition(&self, cond: &Condition, mem: &MemoryStore) -> bool {
        let mut result = false;
        for (i, (logical_op, expr)) in cond.parts.iter().enumerate() {
            let val = self.eval_expr(expr, mem);
            if i == 0 {
                result = val;
            } else {
                match logical_op {
                    Some(LogicalOp::And) => result = result && val,
                    Some(LogicalOp::Or)  => result = result || val,
                    None                 => result = val,
                }
            }
        }
        result
    }

    fn eval_expr(&self, expr: &Expr, mem: &MemoryStore) -> bool {
        match expr {
            Expr::Value(v) => mem_value_is_truthy(&mem.resolve_value(v)),
            Expr::Compare { left, op, right } => {
                let l = mem.resolve_value(left);
                let r = mem.resolve_value(right);
                eval_compare(&l, op, &r)
            }
        }
    }

    pub fn get_valid_intents(&self) -> Vec<String> {
        if let Some(state) = self.states.get(&self.current_state) {
            let mut intents: Vec<String> = state.body.iter().filter_map(|stmt| {
                if let Statement::OnIntent { intent, .. } = stmt {
                    Some(intent.clone())
                } else {
                    None
                }
            }).collect();
            // offtopic_handler is mandatory alongside intents in oriented states;
            // include it so callers can treat it uniformly with other intents.
            if state.body.iter().any(|s| matches!(s, Statement::OnOfftopic { .. })) {
                intents.push("offtopic".to_string());
            }
            intents
        } else {
            vec![]
        }
    }

    pub fn get_graph(&self) -> String {
        let current = &self.current_state;
        let initial = "init";

        let mut out = String::new();
        out.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        out.push_str(&format!(
            "<scxml xmlns=\"http://www.w3.org/2005/07/scxml\" version=\"1.0\" initial=\"{}\">\n",
            escape_xml(initial)
        ));

        for name in &self.state_order {
            if let Some(state) = self.states.get(name) {
                let mut transitions = Vec::new();
                collect_scxml_transitions(name, &state.body, &mut transitions);
                let active = if name == current { " _active=\"true\"" } else { "" };
                if transitions.is_empty() {
                    out.push_str(&format!("  <final id=\"{}\"{}/>\n", escape_xml(name), active));
                } else {
                    out.push_str(&format!("  <state id=\"{}\"{}>\n", escape_xml(name), active));
                    for (event, target) in &transitions {
                        match event {
                            Some(ev) => out.push_str(&format!(
                                "    <transition event=\"{}\" target=\"{}\"/>\n",
                                escape_xml(ev), escape_xml(target)
                            )),
                            None => out.push_str(&format!(
                                "    <transition target=\"{}\"/>\n",
                                escape_xml(target)
                            )),
                        }
                    }
                    out.push_str("  </state>\n");
                }
            }
        }

        out.push_str("</scxml>");
        out
    }
}

fn collect_scxml_transitions(_from: &str, stmts: &[Statement], out: &mut Vec<(Option<String>, String)>) {
    for stmt in stmts {
        match stmt {
            Statement::OnIntent { intent, body } => {
                let to = match body {
                    IntentBody::Next(t) => t.clone(),
                    IntentBody::Block(inner) => find_transition_in_block(inner).unwrap_or_default(),
                };
                if !to.is_empty() {
                    out.push((Some(intent.clone()), to));
                }
            }
            Statement::OnOfftopic { body: stmts } => {
                if let Some(to) = find_transition_in_block(stmts) {
                    out.push((Some("offtopic".to_string()), to));
                }
            }
            Statement::After { body, .. } => {
                if let Some(to) = find_transition_in_block(body) {
                    out.push((Some("after".to_string()), to));
                }
            }
            _ => {}
        }
    }
}

fn find_transition_in_block(stmts: &[Statement]) -> Option<String> {
    for stmt in stmts {
        if let Statement::Transition { target } = stmt {
            return Some(target.clone());
        }
    }
    None
}

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn eval_compare(l: &MemValue, op: &CompareOp, r: &MemValue) -> bool {
    match (l, r) {
        (MemValue::Num(a), MemValue::Num(b)) => match op {
            CompareOp::Eq  => (a - b).abs() < f64::EPSILON,
            CompareOp::Ne  => (a - b).abs() >= f64::EPSILON,
            CompareOp::Gt  => a > b,
            CompareOp::Lt  => a < b,
            CompareOp::Gte => a >= b,
            CompareOp::Lte => a <= b,
        },
        (MemValue::Str(a), MemValue::Str(b)) => match op {
            CompareOp::Eq => a == b,
            CompareOp::Ne => a != b,
            _             => false,
        },
        (MemValue::Bool(a), MemValue::Bool(b)) => match op {
            CompareOp::Eq => a == b,
            CompareOp::Ne => a != b,
            _             => false,
        },
        _ => match op {
            CompareOp::Eq => false,
            CompareOp::Ne => true,
            _             => false,
        },
    }
}

fn mem_value_is_truthy(v: &MemValue) -> bool {
    match v {
        MemValue::Bool(b)   => *b,
        MemValue::Num(n)    => *n != 0.0,
        MemValue::Str(s)    => !s.is_empty(),
        MemValue::Null      => false,
    }
}

