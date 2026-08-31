// SPDX-License-Identifier: Apache-2.0

pub mod fsm;
pub mod memory;

use std::collections::{BTreeMap, BTreeSet};

use crate::effect::{Effect, MemValue};
use dot_agent_parser_dsl::{self as parser, ast::BehaviorFile, ParseError};
use fsm::Fsm;
use memory::MemoryStore;

type FileResolver = Option<Box<dyn Fn(&str) -> Option<String>>>;

/// Look one path up, content map first, registered resolver second.
///
/// The precedence mirrors `flatten_merges`, which resolves `merge "…"` the same way. The lookup is
/// **exact**: no suffix matching, no `knowledge/` prefix guessing, no extension heuristic. The
/// packer bundles a reference verbatim at the path the author wrote, and warns (W016) at pack time
/// when that path is unreachable — accepting a looser form here would bless a shape the packer
/// refuses to bundle. Inline prose therefore never resolves, because prose is not a bundle key.
fn lookup_content(
    path: &str,
    content_files: &BTreeMap<String, String>,
    file_resolver: &FileResolver,
) -> Option<String> {
    content_files
        .get(path)
        .cloned()
        .or_else(|| file_resolver.as_ref().and_then(|r| r(path)))
}

/// Fill `content` on every `Teach` / `Guide` effect whose text names a known file.
///
/// A path with no entry is **not** an error: the effect is still emitted, with `content: None`,
/// and the run continues. That is the deliberate divergence from `merge`, which fails the load.
fn fill_content(
    effects: Vec<Effect>,
    content_files: &BTreeMap<String, String>,
    file_resolver: &FileResolver,
) -> Vec<Effect> {
    effects
        .into_iter()
        .map(|effect| match effect {
            Effect::Teach { text, content: None } => {
                let content = lookup_content(&text, content_files, file_resolver);
                Effect::Teach { text, content }
            }
            Effect::Guide { text, content: None } => {
                let content = lookup_content(&text, content_files, file_resolver);
                Effect::Guide { text, content }
            }
            other => other,
        })
        .collect()
}

pub struct AgentDSLKernel {
    fsm: Option<Fsm>,
    memory: MemoryStore,
    file_resolver: FileResolver,
    content_files: BTreeMap<String, String>,
}

impl AgentDSLKernel {
    pub fn new() -> Self {
        AgentDSLKernel {
            fsm: None,
            memory: MemoryStore::new(),
            file_resolver: None,
            content_files: BTreeMap::new(),
        }
    }

    pub fn set_file_resolver(&mut self, resolver: Box<dyn Fn(&str) -> Option<String>>) {
        self.file_resolver = Some(resolver);
    }

    /// Hand the kernel the knowledge and guide files, keyed by their bundle path.
    ///
    /// Optional, and deliberately separate from the `merge` bundle: a host that wants bare paths —
    /// the CLI's MCP resource server hands them to the LLM host as `dot-agent://<path>` URIs and
    /// lets it fetch lazily — simply never calls this and never pays the payload. Widening the
    /// merge bundle instead would make `merge "knowledge/x.md"` resolvable, turning a clear
    /// "files not found" into a confusing markdown parse error.
    pub fn set_content_files(&mut self, files: BTreeMap<String, String>) {
        self.content_files = files;
    }

    /// Run one FSM step and resolve the teach/guide content of everything it produced.
    ///
    /// Every effect-returning path goes through here so a future method cannot forget the
    /// resolution pass. The fields are destructured because `resolve` needs `content_files` while
    /// `f` holds `fsm` mutably — `self.fill(…)` after `&mut self.fsm` does not borrow-check.
    fn advance(&mut self, f: impl FnOnce(&mut Fsm, &mut MemoryStore) -> Vec<Effect>) -> Vec<Effect> {
        let Self { fsm, memory, file_resolver, content_files } = self;
        match fsm {
            Some(fsm) => fill_content(f(fsm, memory), content_files, file_resolver),
            None => vec![],
        }
    }

    fn fill(&self, effects: Vec<Effect>) -> Vec<Effect> {
        fill_content(effects, &self.content_files, &self.file_resolver)
    }

    pub fn load_behavior(&mut self, text: &str) -> Result<Vec<Effect>, ParseError> {
        let behavior_file = parser::parse_behavior(text)?;
        let mut fsm = Fsm::new(behavior_file)?;
        let effects = fsm.enter_current_state(&mut self.memory);
        self.fsm = Some(fsm);
        Ok(self.fill(effects))
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
        Ok(self.fill(effects))
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
        self.advance(|fsm, mem| fsm.send_intent(intent, mem))
    }

    pub fn send_offtopic(&mut self) -> Vec<Effect> {
        self.advance(|fsm, mem| fsm.send_offtopic(mem))
    }

    pub fn send_event(&mut self, event: &str) -> Vec<Effect> {
        self.advance(|fsm, mem| fsm.send_event(event, mem))
    }

    pub fn tick_prompt(&mut self) -> Vec<Effect> {
        self.advance(|fsm, mem| fsm.tick_prompt(mem))
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

    // ── §2 teach / guide content resolution ───────────────────────────────────

    fn content_map(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
        pairs.iter().map(|(p, c)| (p.to_string(), c.to_string())).collect()
    }

    /// The (text, content) of the first Teach effect in the list.
    fn first_teach(effects: &[Effect]) -> (&str, Option<&str>) {
        effects
            .iter()
            .find_map(|e| match e {
                Effect::Teach { text, content } => Some((text.as_str(), content.as_deref())),
                _ => None,
            })
            .expect("expected a Teach effect")
    }

    fn first_guide(effects: &[Effect]) -> (&str, Option<&str>) {
        effects
            .iter()
            .find_map(|e| match e {
                Effect::Guide { text, content } => Some((text.as_str(), content.as_deref())),
                _ => None,
            })
            .expect("expected a Guide effect")
    }

    #[test]
    fn teach_resolves_bundled_knowledge_content_and_keeps_the_path() {
        let dsl = "state init\n  teach \"knowledge/cars.md\"\n  interact\n";
        let mut k = AgentDSLKernel::new();
        k.set_content_files(content_map(&[("knowledge/cars.md", "# Cars")]));

        let effects = k.load_behavior(dsl).expect("should load");

        let (text, content) = first_teach(&effects);
        assert_eq!(content, Some("# Cars"), "teach must carry the bundled file's content");
        assert_eq!(
            text, "knowledge/cars.md",
            "the literal path must survive — the CLI's MCP resource server hands it on as a URI"
        );
    }

    #[test]
    fn guide_resolves_bundled_guide_content() {
        let dsl = "state init\n  guide \"guides/intro.md\"\n  interact\n";
        let mut k = AgentDSLKernel::new();
        k.set_content_files(content_map(&[("guides/intro.md", "Say hello first.")]));

        let effects = k.load_behavior(dsl).expect("should load");

        let (text, content) = first_guide(&effects);
        assert_eq!(content, Some("Say hello first."), "guide resolves exactly like teach");
        assert_eq!(text, "guides/intro.md");
    }

    #[test]
    fn teach_resolves_through_the_file_resolver_fallback() {
        let dsl = "state init\n  teach \"knowledge/cars.md\"\n  interact\n";
        let mut k = AgentDSLKernel::new();
        k.set_file_resolver(Box::new(|path: &str| {
            if path == "knowledge/cars.md" { Some("# From resolver".to_string()) } else { None }
        }));

        // Empty content map — the resolver is the only source, as it is for merge.
        let effects = k.load_behavior(dsl).expect("should load");

        let (_, content) = first_teach(&effects);
        assert_eq!(content, Some("# From resolver"), "resolver must be the fallback source");
    }

    #[test]
    fn teach_inside_an_intent_handler_resolves_on_send_intent() {
        let dsl = concat!(
            "state init\n",
            "  interact\n",
            "  on intent \"learn\" transition to lesson\n",
            "state lesson\n",
            "  teach \"knowledge/cars.md\"\n",
            "  interact\n",
        );
        let mut k = AgentDSLKernel::new();
        k.set_content_files(content_map(&[("knowledge/cars.md", "# Cars")]));
        k.load_behavior(dsl).expect("should load");

        let effects = k.send_intent("learn");

        let (text, content) = first_teach(&effects);
        assert_eq!(
            content,
            Some("# Cars"),
            "resolution must happen on every advance, not only at load time"
        );
        assert_eq!(text, "knowledge/cars.md");
    }

    #[test]
    fn teach_inline_prose_stays_unresolved() {
        let dsl = "state init\n  teach \"Always confirm before proceeding.\"\n  interact\n";
        let mut k = AgentDSLKernel::new();
        k.set_content_files(content_map(&[("knowledge/cars.md", "# Cars")]));

        let effects = k.load_behavior(dsl).expect("should load");

        let (text, content) = first_teach(&effects);
        assert_eq!(content, None, "lookup is exact — prose is not a bundle key");
        assert_eq!(text, "Always confirm before proceeding.");
    }

    #[test]
    fn teach_path_absent_from_content_files_is_not_an_error() {
        let dsl = "state init\n  teach \"knowledge/missing.md\"\n  interact\n";
        let mut k = AgentDSLKernel::new();

        let effects = k.load_behavior(dsl).expect("an unresolvable teach must not fail the load");

        let (text, content) = first_teach(&effects);
        assert_eq!(content, None, "a missing knowledge file leaves content empty");
        assert_eq!(text, "knowledge/missing.md", "the effect is still emitted, with its path");
    }
}
