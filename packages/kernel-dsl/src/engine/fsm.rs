// SPDX-License-Identifier: Apache-2.0

use std::collections::BTreeMap;

use crate::effect::{Effect, MemValue};
use crate::engine::memory::MemoryStore;
use dot_agent_parser_dsl::{ast::*, ParseError};

const NATIVE_STATES: &[&str] = &["ended"];

/// Wire version of [`FsmSnapshot`]. Bumped whenever the blob's shape changes, so a kernel
/// handed a snapshot it does not understand fails loudly instead of restoring a partial
/// position.
pub const FSM_SNAPSHOT_VERSION: u8 = 1;

pub struct Fsm {
    // Ordered list of state names (for SCXML output ordering).
    state_order: Vec<String>,
    states: BTreeMap<String, StateDef>,
    global_triggers: Vec<TriggerDecl>,
    pub current_state: String,
    pub prompt_count: u32,
}

/// A serializable snapshot of the FSM's position.
///
/// The position is two fields, not one: the active state **and** the prompt counter that
/// drives `after N prompts` handlers, which `transition_to` zeroes on every transition.
/// Restoring the state name alone resumes the wrong FSM — an agent snapshotted with two
/// ticks elapsed would resume at zero and fire `after 3 prompts` a turn late.
///
/// `behavior` is the third field and it carries **identity**, which the other two do not.
/// `v` guards the blob's *shape* — it changes only when this crate changes — so without a
/// fingerprint a blob is admitted on a bare state-name match, and one agent's position
/// restores into an unrelated agent that happens to declare the same name. Because every
/// behavior must declare `init` and `ended` is native, a snapshot taken at either position
/// would otherwise restore into literally any agent.
///
/// Memory is deliberately absent. It belongs to the runtime and already travels through
/// `get_memory` / `set_memory`.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FsmSnapshot {
    pub v: u8,
    pub behavior: String,
    pub state: String,
    pub prompt_count: u32,
}

/// FNV-1a, 64-bit, over the FSM's canonical rendering — see [`Fsm::fingerprint`].
///
/// Hand-rolled rather than `DefaultHasher` on purpose: `DefaultHasher`'s algorithm is
/// explicitly unspecified across Rust releases, and this value is persisted by hosts. A
/// toolchain upgrade would invalidate every stored snapshot with no shape change to justify
/// it. FNV-1a is ten lines and is fixed forever.
fn fnv1a64(bytes: &[u8]) -> u64 {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in bytes {
        hash ^= *byte as u64;
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    hash
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

    // Exec only the non-handler statements at entry (goal, guide, teach, interact, run, set, if, apply, remove, transition).
    fn exec_entry_statements(&mut self, stmts: &[Statement], mem: &mut MemoryStore) -> Vec<Effect> {
        let mut effects = Vec::new();
        let initial_state = self.current_state.clone();
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
                | Statement::Transition { .. }
                | Statement::Parallel { .. } => {
                    effects.extend(self.exec_single(stmt, mem));
                    if self.current_state != initial_state {
                        break;
                    }
                }
                // handlers are not auto-executed at entry
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
        // Saturating, not `+= 1`. The counter is restorable from host storage, so an
        // arbitrary u32 can reach it: `+= 1` at u32::MAX aborts the module in debug (the
        // workspace sets `panic = "abort"`, so the host cannot catch it) and wraps to 0 in
        // release, silently re-arming every `after N prompts` handler in the state. Saturating
        // makes the pathological counter stick instead of firing anything.
        self.prompt_count = self.prompt_count.saturating_add(1);
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

    /// Identity of the loaded behavior, as a 16-hex-digit fingerprint.
    ///
    /// Computed from the FSM's own shape, not from the source text: state names in
    /// declaration order, and per state the intent names with their `transition to` targets,
    /// the presence of an offtopic handler, and every `after N` threshold. Those are exactly
    /// the things a restored position depends on, so the fingerprint changes when — and only
    /// when — an old position may have stopped meaning what it meant. Hashing the source text
    /// instead would invalidate every stored snapshot over a reformatted comment.
    ///
    /// It is a collision-resistance argument, not a security one: the fingerprint stops an
    /// honest mix-up between agents or revisions, and a caller who controls host storage
    /// controls the blob either way. It also does not stop a mix-up between agents that share a
    /// graph shape but differ only in statement payloads the `match` above drops — `goal` text
    /// included — so two behaviors built from the same template can fingerprint identically.
    pub fn fingerprint(&self) -> String {
        let mut canon = String::new();
        for name in &self.state_order {
            canon.push_str("s:");
            canon.push_str(name);
            canon.push('\n');
            let Some(state) = self.states.get(name) else { continue };
            for stmt in &state.body {
                match stmt {
                    Statement::OnIntent { intent, body } => {
                        canon.push_str("  i:");
                        canon.push_str(intent);
                        if let IntentBody::Next(target) = body {
                            canon.push('>');
                            canon.push_str(target);
                        }
                        canon.push('\n');
                    }
                    Statement::OnOfftopic { .. } => canon.push_str("  o\n"),
                    Statement::After { prompts, .. } => {
                        canon.push_str(&format!("  a:{}\n", prompts));
                    }
                    _ => {}
                }
            }
        }
        format!("{:016x}", fnv1a64(canon.as_bytes()))
    }

    /// Capture the FSM position as a serializable blob.
    pub fn snapshot(&self) -> FsmSnapshot {
        FsmSnapshot {
            v: FSM_SNAPSHOT_VERSION,
            behavior: self.fingerprint(),
            state: self.current_state.clone(),
            prompt_count: self.prompt_count,
        }
    }

    /// Reposition the FSM from a snapshot, firing no entry effects.
    ///
    /// Three admissibility rules run **before** any field is written, so a rejected restore
    /// leaves the kernel exactly where it stood: the blob's shape (`v`), the behavior it came
    /// from (`behavior`), and the state name. A partial write would park the FSM on a
    /// position the loaded behavior never declared — the silent invalid position this pair
    /// exists to prevent.
    ///
    /// `prompt_count` deliberately has no rule of its own, and cannot have a useful one: every
    /// value up to `u32::MAX` is reachable by an honest run, since the counter keeps climbing
    /// past the largest declared `after N`. The damage a hostile counter could do is closed at
    /// the other end instead — `tick_prompt` saturates rather than overflowing.
    pub fn restore(&mut self, snap: &FsmSnapshot) -> Result<(), String> {
        if snap.v != FSM_SNAPSHOT_VERSION {
            return Err(format!(
                "restore_state: unsupported snapshot version {} — this kernel reads version {}",
                snap.v, FSM_SNAPSHOT_VERSION
            ));
        }
        if snap.behavior.is_empty() && snap.state.is_empty() {
            return Err(
                "restore_state: the snapshot was taken before any behavior was loaded — it \
                 carries no position to restore"
                    .to_string(),
            );
        }
        let expected = self.fingerprint();
        if snap.behavior != expected {
            return Err(format!(
                "restore_state: snapshot belongs to a different behavior (fingerprint {}, this \
                 kernel is {}) — a position from another agent, or from a revision that changed \
                 the state graph, is not a legal position here",
                snap.behavior, expected
            ));
        }
        if !self.is_known_state(&snap.state) {
            return Err(format!(
                "restore_state: unknown state \"{}\" — the loaded behavior does not declare it",
                snap.state
            ));
        }
        self.current_state = snap.state.clone();
        self.prompt_count = snap.prompt_count;
        Ok(())
    }

    /// Whether a name is a legal position for this FSM: a declared state, or a native one.
    ///
    /// `restore` and `transition_to` share this test so the two admissibility rules cannot
    /// drift apart.
    fn is_known_state(&self, name: &str) -> bool {
        self.states.contains_key(name) || NATIVE_STATES.contains(&name)
    }

    fn transition_to(&mut self, target: &str, _mem: &mut MemoryStore) -> Vec<Effect> {
        let from = self.current_state.clone();
        if self.is_known_state(target) {
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
        let initial_state = self.current_state.clone();
        for stmt in &stmts {
            effects.extend(self.exec_single(stmt, mem));
            if self.current_state != initial_state {
                break;
            }
        }
        effects
    }

    fn exec_single(&mut self, stmt: &Statement, mem: &mut MemoryStore) -> Vec<Effect> {
        match stmt {
            Statement::Goal { text } => vec![Effect::Goal { text: text.clone() }],

            // `content` is left None here on purpose: the FSM has no notion of files. The
            // kernel fills it in on the way out (engine::AgentDSLKernel::fill_content), which is
            // where the content map and the file resolver live.
            Statement::Guide { text } => vec![Effect::Guide { text: text.clone(), content: None }],

            Statement::Teach { text } => vec![Effect::Teach { text: text.clone(), content: None }],

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
            Statement::Transition { target } => {
                out.push((None, target.clone()));
            }
            Statement::OnIntent { intent, body } => match body {
                IntentBody::Next(target) => {
                    out.push((Some(intent.clone()), target.clone()));
                }
                IntentBody::Block(inner) => {
                    let mut inner_out = Vec::new();
                    collect_scxml_transitions(_from, inner, &mut inner_out);
                    for (_, target) in inner_out {
                        out.push((Some(intent.clone()), target));
                    }
                }
            },
            Statement::OnOfftopic { body: stmts } => {
                let mut inner_out = Vec::new();
                collect_scxml_transitions(_from, stmts, &mut inner_out);
                for (_, target) in inner_out {
                    out.push((Some("offtopic".to_string()), target));
                }
            }
            Statement::After { prompts, body } => {
                let mut inner_out = Vec::new();
                collect_scxml_transitions(_from, body, &mut inner_out);
                for (_, target) in inner_out {
                    out.push((Some(format!("after_{}_prompts", prompts)), target));
                }
            }
            Statement::If { then_body, else_body, .. } => {
                collect_scxml_transitions(_from, then_body, out);
                if let Some(stmts) = else_body {
                    collect_scxml_transitions(_from, stmts, out);
                }
            }
            Statement::Parallel { body, on_failure } => {
                collect_scxml_transitions(_from, body, out);
                if let Some(stmts) = on_failure {
                    collect_scxml_transitions(_from, stmts, out);
                }
            }
            Statement::Interact { handlers } => {
                collect_scxml_transitions(_from, handlers, out);
            }
            _ => {}
        }
    }
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
        // Two nulls are equal. An unresolvable reference resolves to Null, so
        // `== null` / `!= null` is how a behavior asks whether a path is set —
        // the mixed-pair arm below would answer both of those backwards. See
        // ADR DA00-11. Ordering against null stays false, as it is for every
        // other mismatched pair.
        (MemValue::Null, MemValue::Null) => matches!(op, CompareOp::Eq),
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

