// SPDX-License-Identifier: Apache-2.0

pub mod fsm;
pub mod memory;

use std::collections::{BTreeMap, BTreeSet};

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
        let mut fsm = Fsm::new(behavior_file)?;
        let effects = fsm.enter_current_state(&mut self.memory);
        self.fsm = Some(fsm);
        Ok(effects)
    }

    pub fn load_behavior_with_bundle(
        &mut self,
        main_text: &str,
        bundle: &BTreeMap<String, String>,
    ) -> Result<Vec<Effect>, ParseError> {
        let behavior_file = parser::parse_behavior(main_text)?;
        let mut visited = BTreeSet::new();
        let flattened = self.flatten_merges(behavior_file, bundle, &mut visited)?;
        let mut fsm = Fsm::new(flattened)?;
        let effects = fsm.enter_current_state(&mut self.memory);
        self.fsm = Some(fsm);
        Ok(effects)
    }

    fn flatten_merges(
        &self,
        mut behavior: BehaviorFile,
        bundle: &BTreeMap<String, String>,
        visited: &mut BTreeSet<String>,
    ) -> Result<BehaviorFile, ParseError> {
        let mut missing: Vec<String> = Vec::new();
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
                None => missing.push(path),
            }
        }
        if !missing.is_empty() {
            return Err(ParseError(format!(
                "merge: files not found: {}",
                missing.iter().map(|p| format!("\"{}\"", p)).collect::<Vec<_>>().join(", ")
            )));
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

    /// Capture the FSM position — behavior fingerprint, active state, prompt counter.
    ///
    /// With no behavior loaded this returns a degenerate blob with both string fields empty,
    /// matching how `get_current_state` and `get_graph` answer that case. The condition is
    /// caught at the other end: `restore` rejects that blob by name, saying it was taken
    /// before any behavior was loaded.
    pub fn serialize_state(&self) -> fsm::FsmSnapshot {
        self.fsm.as_ref().map(|f| f.snapshot()).unwrap_or(fsm::FsmSnapshot {
            v: fsm::FSM_SNAPSHOT_VERSION,
            behavior: String::new(),
            state: String::new(),
            prompt_count: 0,
        })
    }

    /// The same snapshot as compact JSON — the form a host stores.
    ///
    /// The `expect` is unreachable and says so: [`fsm::FsmSnapshot`] is a `u8`, two `String`s
    /// and a `u32`, and `serde_json` cannot fail on those. Returning an empty string on error
    /// instead would hand the host a blob that lies about a *serialization* failure and only
    /// surfaces it, much later, as a restore error naming the wrong cause.
    pub fn serialize_state_json(&self) -> String {
        serde_json::to_string(&self.serialize_state())
            .expect("FsmSnapshot is three scalars and two strings — serialization cannot fail")
    }

    /// Reposition the FSM from a snapshot, firing no entry effects.
    ///
    /// **Call order matters, and the docstring above is true only of this function.** A host
    /// rehydrating a session must `load_behavior` first — this call errors without it — and
    /// `load_behavior` enters the init state, so its entry effects (typically `Goal` +
    /// `RequestInteract`) are emitted before the position can be corrected. Those effects
    /// belong to a state the session is no longer in: **discard them**, then restore. The
    /// sequence is `load_behavior` → drop its effects → `restore_state` → `set_memory` →
    /// `send_intent`.
    ///
    /// Memory is untouched by design; the host re-injects it with `set_memory`.
    pub fn restore_state(&mut self, snap: &fsm::FsmSnapshot) -> Result<(), String> {
        match &mut self.fsm {
            Some(fsm) => fsm.restore(snap),
            None => Err(
                "restore_state: no behavior loaded — call load_behavior first".to_string()
            ),
        }
    }

    /// Reposition from the JSON blob `serialize_state_json` produced.
    ///
    /// The malformed-blob rejection lives here rather than in the `#[wasm_bindgen]` wrapper so
    /// it is reachable from a plain `cargo test`: the wrapper is then nothing but the
    /// `String` → `JsError` conversion, with no behavior of its own to go untested.
    pub fn restore_state_json(&mut self, state_json: &str) -> Result<(), String> {
        let snapshot: fsm::FsmSnapshot = serde_json::from_str(state_json)
            .map_err(|e| format!("restore_state: malformed snapshot — {}", e))?;
        self.restore_state(&snapshot)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::effect::Effect;
    use std::collections::BTreeMap;

    fn kernel_with(dsl: &str) -> AgentDSLKernel {
        let mut k = AgentDSLKernel::new();
        k.load_behavior(dsl).expect("DSL should parse");
        k
    }

    #[test]
    fn transition_to_ended_emits_effect_and_updates_state() {
        let dsl = "state init\n  interact\n  on intent \"done\" transition to ended\n";
        let mut k = kernel_with(dsl);

        let effects = k.send_intent("done");

        let transition = effects.iter().find(|e| matches!(e, Effect::Transition { .. }));
        assert!(transition.is_some(), "expected Transition effect");
        if let Some(Effect::Transition { from, to }) = transition {
            assert_eq!(from, "init");
            assert_eq!(to, "ended");
        }
        assert_eq!(k.get_current_state(), "ended");
    }

    #[test]
    fn transition_to_unknown_state_emits_nothing() {
        let dsl = "state init\n  interact\n  on intent \"go\" transition to nonexistent\n";
        let mut k = kernel_with(dsl);

        let effects = k.send_intent("go");

        let transition = effects.iter().find(|e| matches!(e, Effect::Transition { .. }));
        assert!(transition.is_none(), "unknown target must not emit Transition");
        assert_eq!(k.get_current_state(), "init", "state must not change");
    }

    #[test]
    fn load_behavior_without_init_state_returns_error() {
        let dsl = "state welcome\n  interact\n";
        let mut k = AgentDSLKernel::new();
        let result = k.load_behavior(dsl);
        assert!(result.is_err(), "missing 'init' state must return Err");
        assert!(result.unwrap_err().0.contains("E016"), "error must reference E016");
    }

    // ── §1 merge runtime ──────────────────────────────────────────────────────

    const MAIN_DSL: &str = concat!(
        "merge \"shared.behavior\"\n",
        "state init\n",
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
        let mut bundle = BTreeMap::new();
        bundle.insert("shared.behavior".to_string(), SHARED_DSL.to_string());

        let mut k = AgentDSLKernel::new();
        k.load_behavior_with_bundle(MAIN_DSL, &bundle).expect("should load");

        assert_eq!(k.get_current_state(), "init");

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
        k.load_behavior_with_bundle(MAIN_DSL, &BTreeMap::new()).expect("should load via resolver");

        assert_eq!(k.get_current_state(), "init");

        let effects = k.send_intent("next");
        let transition = effects.iter().find(|e| matches!(e, Effect::Transition { to, .. } if to == "detail"));
        assert!(transition.is_some(), "resolver must supply merged states");
        assert_eq!(k.get_current_state(), "detail");
    }

    #[test]
    fn merge_missing_path_is_an_error() {
        let dsl = "merge \"nonexistent.behavior\"\nstate init\n  interact\n";
        let mut k = AgentDSLKernel::new();
        let result = k.load_behavior_with_bundle(dsl, &BTreeMap::new());
        assert!(result.is_err(), "missing merge with no resolver must return an error");
        let err = result.unwrap_err();
        assert!(err.0.contains("nonexistent.behavior"), "error must name the missing path");
    }

    #[test]
    fn merge_missing_path_with_resolver_returns_error_when_resolver_returns_none() {
        let dsl = "merge \"nonexistent.behavior\"\nstate init\n  interact\n";
        let mut k = AgentDSLKernel::new();
        k.set_file_resolver(Box::new(|_| None));
        let result = k.load_behavior_with_bundle(dsl, &BTreeMap::new());
        assert!(result.is_err(), "resolver returning None must still produce an error");
    }

    #[test]
    fn main_state_takes_precedence_over_merged_duplicate() {
        let shared = "state init\n  goal \"from shared\"\n";
        let main = concat!(
            "merge \"shared.behavior\"\n",
            "state init\n",
            "  goal \"from main\"\n",
            "  interact\n",
        );
        let mut bundle = BTreeMap::new();
        bundle.insert("shared.behavior".to_string(), shared.to_string());

        let mut k = AgentDSLKernel::new();
        let effects = k.load_behavior_with_bundle(main, &bundle).expect("should load");

        let goal_text: Vec<_> = effects.iter().filter_map(|e| {
            if let Effect::Goal { text } = e { Some(text.as_str()) } else { None }
        }).collect();
        assert_eq!(goal_text, ["from main"], "main file's state must shadow merged duplicate");
    }

    // ── §2 snapshot & restore of the FSM position ─────────────────────────────

    const TWO_STATE_DSL: &str = concat!(
        "state init\n",
        "  interact\n",
        "  on intent \"next\" transition to detail\n",
        "state detail\n",
        "  interact\n",
        "  on intent \"done\" transition to ended\n",
    );

    fn blob_of(k: &AgentDSLKernel) -> String {
        k.serialize_state_json()
    }

    /// A snapshot carrying `k`'s own behavior fingerprint, positioned by hand.
    ///
    /// A test that wants a *foreign* blob builds it from a second kernel — never by editing
    /// this fingerprint, which would test the assertion rather than the guard.
    fn snap_for(k: &AgentDSLKernel, state: &str, prompt_count: u32) -> fsm::FsmSnapshot {
        let mut snap = k.serialize_state();
        snap.state = state.to_string();
        snap.prompt_count = prompt_count;
        snap
    }

    fn snapshot_from(json: &str) -> fsm::FsmSnapshot {
        serde_json::from_str(json).expect("blob must deserialize")
    }

    #[test]
    fn round_trips_state_and_prompt_count() {
        let mut k = kernel_with(TWO_STATE_DSL);
        k.send_intent("next");
        assert_eq!(k.get_current_state(), "detail");
        k.tick_prompt();
        k.tick_prompt();

        let blob = blob_of(&k);
        assert!(blob.contains("\"state\":\"detail\""), "blob must carry the state: {}", blob);
        // 2, not 4 — transition_to zeroes the counter, so only the ticks in `detail` count.
        assert!(blob.contains("\"prompt_count\":2"), "blob must carry the counter: {}", blob);
        assert!(
            blob.contains(&format!("\"behavior\":\"{}\"", kernel_with(TWO_STATE_DSL).serialize_state().behavior)),
            "blob must carry the behavior fingerprint: {}",
            blob
        );

        let mut fresh = kernel_with(TWO_STATE_DSL);
        assert_eq!(fresh.get_current_state(), "init");
        fresh.restore_state(&snapshot_from(&blob)).expect("restore must succeed");
        assert_eq!(fresh.get_current_state(), "detail");
        assert_eq!(blob_of(&fresh), blob, "a restored kernel must re-serialize identically");
    }

    #[test]
    fn restore_state_restores_prompt_count_so_after_handler_fires_on_the_right_turn() {
        let dsl = concat!(
            "state init\n",
            "  interact\n",
            "  on intent \"next\" transition to detail\n",
            "state detail\n",
            "  interact\n",
            "  after 3 prompts\n",
            "    set session.nudged = true\n",
            "  end\n",
        );
        let mut k = kernel_with(dsl);
        let snap = snap_for(&k, "detail", 2);
        k.restore_state(&snap).expect("restore must succeed");

        let effects = k.tick_prompt();
        let nudged = effects
            .iter()
            .find(|e| matches!(e, Effect::SetMemory { key, .. } if key == "nudged"));
        assert!(
            nudged.is_some(),
            "the third prompt overall must fire the handler — a dropped counter would restart at 0 \
             and this tick would be turn 1: {:?}",
            effects
        );
    }

    #[test]
    fn restore_state_does_not_fire_entry_effects() {
        let dsl = concat!(
            "state init\n",
            "  interact\n",
            "  on intent \"next\" transition to detail\n",
            "state detail\n",
            "  goal \"welcome back\"\n",
            "  interact\n",
            "  on intent \"done\" transition to ended\n",
        );
        let mut k = kernel_with(dsl);
        let snap = snap_for(&k, "detail", 0);

        // The signature carries no effects at all — repositioning is silent by construction.
        let restored: Result<(), String> = k.restore_state(&snap);
        assert!(restored.is_ok(), "restore must succeed: {:?}", restored);

        // …and the position is genuinely live, not a bare field write.
        assert_eq!(k.get_current_state(), "detail");
        assert_eq!(k.get_valid_intents(), vec!["done".to_string()]);
        let effects = k.send_intent("done");
        assert!(
            effects.iter().any(|e| matches!(e, Effect::Transition { to, .. } if to == "ended")),
            "the restored state's own handlers must dispatch"
        );
    }

    #[test]
    fn rehydration_emits_entry_effects_the_host_must_discard_before_restoring() {
        // The consumer's real path, and the one place the "no entry effects" contract is easy
        // to misread: restore_state needs a loaded behavior, and load_behavior enters `init`.
        let dsl = concat!(
            "state init\n",
            "  goal \"say hello\"\n",
            "  interact\n",
            "  on intent \"next\" transition to detail\n",
            "state detail\n",
            "  goal \"take the booking\"\n",
            "  interact\n",
            "  on intent \"done\" transition to ended\n",
        );
        let mut first = kernel_with(dsl);
        first.send_intent("next");
        let blob = blob_of(&first);

        let mut resumed = AgentDSLKernel::new();
        let on_load = resumed.load_behavior(dsl).expect("should load");
        // Exactly what the host has to drop: init's entry burst, for a state the session left.
        assert!(
            matches!(on_load.first(), Some(Effect::Goal { text }) if text == "say hello"),
            "load_behavior emits init's goal before the position can be corrected: {:?}",
            on_load
        );
        assert!(
            on_load.iter().any(|e| matches!(e, Effect::RequestInteract)),
            "…and its request_interact: {:?}",
            on_load
        );

        resumed
            .restore_state_json(&blob)
            .expect("restore must succeed after the load");
        assert_eq!(resumed.get_current_state(), "detail");
        // Nothing after the restore replays the discarded burst.
        let effects = resumed.send_intent("done");
        assert!(
            effects.iter().any(|e| matches!(e, Effect::Transition { to, .. } if to == "ended")),
            "the resumed session continues from `detail`: {:?}",
            effects
        );
    }

    #[test]
    fn restore_state_rejects_a_snapshot_from_another_behavior() {
        // Two unrelated agents that both declare `detail`. Before the fingerprint, agent A's
        // position restored into agent B and left it on B's state with B's handlers.
        let agent_a = TWO_STATE_DSL;
        let agent_b = concat!(
            "state init\n",
            "  interact\n",
            "  on intent \"start\" transition to detail\n",
            "state detail\n",
            "  interact\n",
            "  on intent \"refund\" transition to ended\n",
        );

        let mut a = kernel_with(agent_a);
        a.send_intent("next");
        assert_eq!(a.get_current_state(), "detail");
        let foreign = blob_of(&a);

        let mut b = kernel_with(agent_b);
        let err = b
            .restore_state_json(&foreign)
            .expect_err("a blob from another behavior must be rejected on the name match");
        assert!(
            err.contains("different behavior"),
            "the error must name the mismatch, not the state: {}",
            err
        );
        assert_eq!(b.get_current_state(), "init", "the rejected restore must move nothing");
    }

    #[test]
    fn restore_state_rejects_a_snapshot_from_a_changed_revision_of_the_same_behavior() {
        // `init` is mandatory and `ended` is native, so a position at either one restores into
        // any agent unless the fingerprint separates revisions too.
        let before = TWO_STATE_DSL;
        let after = concat!(
            "state init\n",
            "  interact\n",
            "  on intent \"next\" transition to triage\n",
            "state triage\n",
            "  interact\n",
            "  on intent \"escalate\" transition to detail\n",
            "state detail\n",
            "  interact\n",
            "  on intent \"done\" transition to ended\n",
        );
        let old_blob = blob_of(&kernel_with(before));

        let mut revised = kernel_with(after);
        let err = revised
            .restore_state_json(&old_blob)
            .expect_err("a position from a changed state graph must be rejected");
        assert!(err.contains("different behavior"), "the error must say why: {}", err);
    }

    #[test]
    fn restore_state_to_unknown_state_errors_and_leaves_kernel_untouched() {
        let mut k = kernel_with(TWO_STATE_DSL);
        k.tick_prompt();

        let snap = snap_for(&k, "nonexistent", 42);
        let err = k.restore_state(&snap).expect_err("unknown state must be rejected");
        assert!(err.contains("nonexistent"), "the error must name the offending state: {}", err);

        // Validate-before-assign: a rejected restore moves neither field.
        assert_eq!(k.get_current_state(), "init", "state must not change");
        assert!(
            blob_of(&k).contains("\"prompt_count\":1"),
            "the counter must not change either: {}",
            blob_of(&k)
        );
    }

    #[test]
    fn restore_state_to_native_ended_succeeds() {
        let mut k = kernel_with(TWO_STATE_DSL);
        let snap = snap_for(&k, "ended", 0);
        k.restore_state(&snap).expect("a native state is a legal position, like transition_to's");
        assert_eq!(k.get_current_state(), "ended");
    }

    #[test]
    fn restore_state_without_loaded_behavior_errors() {
        let mut k = AgentDSLKernel::new();
        let snap = fsm::FsmSnapshot {
            v: fsm::FSM_SNAPSHOT_VERSION,
            behavior: "0123456789abcdef".to_string(),
            state: "init".to_string(),
            prompt_count: 0,
        };
        let err = k.restore_state(&snap).expect_err("no FSM means nothing to reposition");
        assert!(err.contains("no behavior loaded"), "the error must say why: {}", err);
    }

    #[test]
    fn restore_state_rejects_a_snapshot_taken_before_any_behavior_was_loaded() {
        // The degenerate blob an empty kernel serializes, restored into a loaded one. The
        // error must name its origin rather than blaming the empty state name.
        let empty_blob = blob_of(&AgentDSLKernel::new());
        let mut k = kernel_with(TWO_STATE_DSL);
        let err = k
            .restore_state_json(&empty_blob)
            .expect_err("a blob with no position must be rejected");
        assert!(
            err.contains("before any behavior was loaded"),
            "the error must name its actual cause: {}",
            err
        );
        assert_eq!(k.get_current_state(), "init");
    }

    #[test]
    fn restore_state_rejects_malformed_snapshot() {
        let mut k = kernel_with(TWO_STATE_DSL);

        // Both go through the real entry point, so the rejection under test is the kernel's,
        // not serde's own round trip.
        let err = k.restore_state_json("{").expect_err("a non-JSON blob must be rejected");
        assert!(err.contains("malformed snapshot"), "the error must say what failed: {}", err);
        let err = k.restore_state_json("{}").expect_err("a blob missing every field is malformed");
        assert!(err.contains("malformed snapshot"), "the error must say what failed: {}", err);

        // A future blob shape parses but must not be applied — the version stamp is the guard.
        let mut future = k.serialize_state();
        future.v = 99;
        future.state = "detail".to_string();
        let err = k.restore_state(&future).expect_err("an unreadable version must be rejected");
        assert!(err.contains("version"), "the error must name the version: {}", err);

        assert_eq!(k.get_current_state(), "init", "no rejected blob may move the kernel");
    }

    #[test]
    fn a_restored_prompt_count_at_the_ceiling_neither_overflows_nor_rearms() {
        // The counter is the one snapshot field with no admissibility rule — every value is
        // reachable by an honest run — so the guard is in tick_prompt, which saturates.
        let dsl = concat!(
            "state init\n",
            "  interact\n",
            "  after 1 prompts\n",
            "    set session.nudged = true\n",
            "  end\n",
        );
        let mut k = kernel_with(dsl);
        let snap = snap_for(&k, "init", u32::MAX);
        k.restore_state(&snap).expect("restore must succeed");

        let effects = k.tick_prompt(); // `+= 1` here would abort in debug, wrap to 0 in release.
        assert!(
            effects.is_empty(),
            "a saturated counter must fire nothing — wrapping to 0 would re-arm `after 1`: {:?}",
            effects
        );
        assert!(
            blob_of(&k).contains(&format!("\"prompt_count\":{}", u32::MAX)),
            "the counter must stick at the ceiling: {}",
            blob_of(&k)
        );
    }
}
