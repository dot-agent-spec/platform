// SPDX-License-Identifier: Apache-2.0

pub mod fsm;
pub mod memory;

use std::collections::{BTreeMap, BTreeSet};

use crate::effect::{Effect, MemValue};
use dot_agent_parser_dsl::{self as parser, ast::BehaviorFile, ParseError};
use fsm::Fsm;
use memory::MemoryStore;

type FileResolver = Option<Box<dyn Fn(&str) -> Option<String>>>;

/// The packer's `normalizeRefPath`, reproduced.
///
/// The bundle key is **not** the raw argument. `pack.ts` converts `\` to `/` and strips one leading
/// `./` before deciding where the file lands, so `teach "./knowledge/cars.md"` packs clean — no
/// E018, no W015, no W016 — under the key `knowledge/cars.md`. Looking the raw text up would miss
/// it and hand the host `content: null` with no diagnostic at either end.
///
/// This is normalization, not the prefix/suffix guessing [`lookup_content`] refuses: it maps a
/// reference onto the one key the packer would have written for it, and onto nothing else. Keep it
/// identical to `normalizeRefPath` — the two are one rule expressed twice.
fn normalize_ref_path(text: &str) -> String {
    let slashed = text.replace('\\', "/");
    slashed.strip_prefix("./").unwrap_or(&slashed).to_string()
}

/// The packer's `FILE_REF_RE`, reproduced: a trailing `.txt`/`.md` is what makes an argument a file
/// reference rather than prose, and it is the only signal either layer has.
fn looks_like_file_ref(text: &str) -> bool {
    let lower = text.to_ascii_lowercase();
    lower.ends_with(".txt") || lower.ends_with(".md")
}

/// Look one reference up, content map first, registered resolver second.
///
/// The precedence mirrors `flatten_merges`, which resolves `merge "…"` the same way. The key is
/// [`normalize_ref_path`] of the effect text and the match on it is **exact**: no suffix matching,
/// no `knowledge/` prefix guessing, no extension heuristic. The packer bundles a reference at that
/// normalized path and warns (W016) at pack time when it is unreachable — accepting a looser form
/// here would bless a shape the packer refuses to bundle.
///
/// The resolver is consulted only for text that [`looks_like_file_ref`]. Without that gate a state
/// carrying two prose statements fires the host's callback once per sentence per entry: a syscall
/// per sentence for a filesystem-backed resolver, and an opening for a permissive one to answer a
/// sentence with something that silently becomes `content`. The map lookup stays unconditional —
/// it is a pure in-memory hit on a key the host chose itself, so it has neither cost nor surprise.
fn lookup_content(
    text: &str,
    content_files: &BTreeMap<String, String>,
    file_resolver: &FileResolver,
) -> Option<String> {
    let path = normalize_ref_path(text);
    if let Some(found) = content_files.get(&path) {
        return Some(found.clone());
    }
    if !looks_like_file_ref(&path) {
        return None;
    }
    file_resolver.as_ref().and_then(|r| r(&path))
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

    // ── issue #5: a condition and a `set` right-hand side must READ memory ────
    //
    // An unquoted operand is a memory reference. Before the fix the parser
    // handed the kernel the path TEXT as a plain string, so `resolve_value`
    // returned that text instead of looking the path up: every comparison
    // against memory was false, every truthy check was true, and a
    // memory-to-memory `set` copied the literal string "session.src".

    fn kernel_with_memory(seed: &[(&str, &str, MemValue)], dsl: &str) -> AgentDSLKernel {
        let mut k = AgentDSLKernel::new();
        for (domain, key, value) in seed {
            k.set_memory(domain, key, value.clone());
        }
        k.load_behavior(dsl).expect("DSL should parse");
        k
    }

    const I5_BOOL_DSL: &str = concat!(
        "state init\n",
        "  if context.onboarding == true\n",
        "    transition to onboarding\n",
        "  else\n",
        "    transition to responsive\n",
        "  end\n",
        "\n",
        "state onboarding\n",
        "  interact\n",
        "\n",
        "state responsive\n",
        "  interact\n",
    );

    #[test]
    fn i5_eq_true_matches_bool_memory() {
        // The issue's own reproduction. Both cases live in one test on purpose:
        // the `false` case passes even without the fix (everything fell to the
        // else branch back then), so alone it would prove nothing. It stays as
        // an over-correction guard beside the case that actually goes red.
        let k = kernel_with_memory(&[("context", "onboarding", MemValue::Bool(true))], I5_BOOL_DSL);
        assert_eq!(k.get_current_state(), "onboarding", "Bool(true) must take the then-branch");

        let k = kernel_with_memory(&[("context", "onboarding", MemValue::Bool(false))], I5_BOOL_DSL);
        assert_eq!(k.get_current_state(), "responsive", "Bool(false) must take the else-branch");
    }

    #[test]
    fn i5_numeric_compare_reads_memory() {
        let dsl = concat!(
            "state init\n",
            "  if session.count > 3\n",
            "    transition to hi\n",
            "  else\n",
            "    transition to lo\n",
            "  end\n",
            "\n",
            "state hi\n",
            "  interact\n",
            "\n",
            "state lo\n",
            "  interact\n",
        );
        let k = kernel_with_memory(&[("session", "count", MemValue::Num(7.0))], dsl);
        assert_eq!(k.get_current_state(), "hi", "a numeric comparison must read the stored number");
    }

    #[test]
    fn i5_quoted_string_stays_a_literal() {
        // Earns its place twice: string comparison against memory works, AND a
        // quoted operand must NOT be resolved as a memory path.
        let dsl = concat!(
            "state init\n",
            "  if context.name == \"danilo\"\n",
            "    transition to yes\n",
            "  else\n",
            "    transition to nope\n",
            "  end\n",
            "\n",
            "state yes\n",
            "  interact\n",
            "\n",
            "state nope\n",
            "  interact\n",
        );
        let k = kernel_with_memory(&[("context", "name", MemValue::Str("danilo".into()))], dsl);
        assert_eq!(k.get_current_state(), "yes", "stored string must compare against the literal");
    }

    #[test]
    fn i5_truthy_reads_memory_not_path_text() {
        // Disproves the workaround the issue documents: a bare truthy check used
        // to see the non-empty path text and fire unconditionally.
        let dsl = concat!(
            "state init\n",
            "  if context.flag\n",
            "    transition to yes\n",
            "  else\n",
            "    transition to nope\n",
            "  end\n",
            "\n",
            "state yes\n",
            "  interact\n",
            "\n",
            "state nope\n",
            "  interact\n",
        );
        let k = kernel_with_memory(&[("context", "flag", MemValue::Bool(false))], dsl);
        assert_eq!(k.get_current_state(), "nope", "a falsy stored value must take the else-branch");
    }

    #[test]
    fn i5_set_from_path_copies_memory_value() {
        // Symptom that reaches the SDK through Effect::SetMemory.
        let dsl = concat!(
            "state init\n",
            "  set context.copy = session.src\n",
            "  interact\n",
        );
        let k = kernel_with_memory(&[("session", "src", MemValue::Num(42.0))], dsl);
        let snapshot = k.get_memory();
        let copied = snapshot
            .entries
            .iter()
            .find(|e| e.domain == "context" && e.key == "copy")
            .expect("context.copy must exist after the set");
        assert!(
            matches!(copied.value, MemValue::Num(n) if n == 42.0),
            "set from a memory path must copy the VALUE, got: {:?}",
            copied.value
        );
    }

    /// `state init` … the two branch states, appended to a condition body.
    const BRANCHES: &str = "\n\nstate yes\n  interact\n\nstate lo\n  interact\n";

    fn branch_taken(condition: &str, seed: &[(&str, &str, MemValue)]) -> String {
        let dsl = format!(
            "state init\n  if {}\n    transition to yes\n  else\n    transition to lo\n  end{}",
            condition, BRANCHES
        );
        kernel_with_memory(seed, &dsl).get_current_state().to_string()
    }

    #[test]
    fn i5_both_operands_are_tagged_under_a_non_eq_operator() {
        // The tagging applies to an operand POSITION, so the right-hand side of a
        // comparison is a reference too, and every operator goes through the same
        // `resolve_value`. Pinned because a future mapping change could keep the
        // left side working and silently drop the right.
        let seed = |a: f64, b: f64| {
            vec![
                ("session", "a", MemValue::Num(a)),
                ("session", "b", MemValue::Num(b)),
            ]
        };
        assert_eq!(branch_taken("session.a != session.b", &seed(1.0, 2.0)), "yes");
        assert_eq!(branch_taken("session.a != session.b", &seed(2.0, 2.0)), "lo");
        assert_eq!(branch_taken("session.a >= session.b", &seed(2.0, 2.0)), "yes");
    }

    // ── DA00-11: an unresolvable reference is null, and null equality is how a
    // behavior tests whether a path is set ───────────────────────────────────

    #[test]
    fn null_equality_tests_whether_a_path_is_set() {
        let set = [("context", "x", MemValue::Str("v".into()))];
        assert_eq!(branch_taken("context.x == null", &[]), "yes", "an unset path IS null");
        assert_eq!(branch_taken("context.x == null", &set), "lo", "a set path is not null");
        assert_eq!(branch_taken("context.x != null", &set), "yes", "`!= null` means: is set");
        assert_eq!(branch_taken("context.x != null", &[]), "lo", "an unset path fails `!= null`");
    }

    #[test]
    fn bare_word_equality_is_null_equality() {
        // The larger half of DA00-11's consequence, and the one an author is most
        // likely to be bitten by: DA00-10 makes an operand with no domain prefix a
        // reference that resolves to null, and reflexive null equality then makes any
        // two unresolvable operands equal. `if user.plan == free`, written meaning a
        // string literal, fires whenever `user.plan` is unset. Pinned here so a later
        // change to eval_compare cannot revert the documented behavior in silence.
        let set = [("context", "plan", MemValue::Str("pro".into()))];
        assert_eq!(branch_taken("mode == active", &[]), "yes", "two bare words are both null, so equal");
        assert_eq!(branch_taken("mode != active", &[]), "lo", "and therefore not unequal");
        assert_eq!(branch_taken("context.missing == planning", &[]), "yes", "unset path vs bare word: both null");
        assert_eq!(branch_taken("context.plan == free", &set), "lo", "a resolvable operand is not null, so no match");
    }

    #[test]
    fn an_unset_path_compared_to_a_literal() {
        // The rest of the table in dsl/reference/memory.md, pinned so the document
        // and the kernel cannot drift apart: `==` is false, `!=` is true, an
        // ordering comparison is false, and null is not truthy.
        assert_eq!(branch_taken("context.missing == \"x\"", &[]), "lo");
        assert_eq!(branch_taken("context.missing != \"x\"", &[]), "yes");
        assert_eq!(branch_taken("context.missing > 3", &[]), "lo");
        assert_eq!(branch_taken("context.missing", &[]), "lo");
    }

    #[test]
    fn an_unqualified_bare_word_on_a_set_stores_null() {
        // The one observable break DA00-10 accepts: a lookup needs
        // `<domain>.<key>`, so `planning` is a reference that cannot resolve and
        // the store receives null — where the pre-tagging runtime wrote the text
        // `"planning"`. Quoting it is what makes it a literal again.
        let dsl = "state init\n  set context.stage = planning\n  interact\n";
        let bare = kernel_with_memory(&[], dsl).get_memory();
        let stored = bare
            .entries
            .iter()
            .find(|e| e.domain == "context" && e.key == "stage")
            .expect("context.stage must exist after the set");
        assert!(
            matches!(stored.value, MemValue::Null),
            "an unqualified bare word has no domain to read, so it resolves to null, got: {:?}",
            stored.value
        );

        let quoted = "state init\n  set context.stage = \"planning\"\n  interact\n";
        let quoted = kernel_with_memory(&[], quoted).get_memory();
        let stored = quoted
            .entries
            .iter()
            .find(|e| e.domain == "context" && e.key == "stage")
            .expect("context.stage must exist after the set");
        assert!(
            matches!(&stored.value, MemValue::Str(s) if s == "planning"),
            "a quoted right-hand side is a literal and must survive, got: {:?}",
            stored.value
        );

        // `true`, `false` and `null` are literals to the grammar, not bare words —
        // which is why `set session.supersedes = true`, the only `set` in the
        // tracked corpus, is unaffected by any of this.
        let boolean = "state init\n  set context.flag = true\n  interact\n";
        let boolean = kernel_with_memory(&[], boolean).get_memory();
        let stored = boolean
            .entries
            .iter()
            .find(|e| e.domain == "context" && e.key == "flag")
            .expect("context.flag must exist after the set");
        assert!(
            matches!(stored.value, MemValue::Bool(true)),
            "a boolean literal is not a bare word, got: {:?}",
            stored.value
        );
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

    #[test]
    fn normalize_ref_path_matches_the_packer() {
        // These three lines are `normalizeRefPath` in packages/compiler/src/pack.ts. If that
        // function grows a rule, this test is where the kernel finds out it fell behind.
        assert_eq!(normalize_ref_path("knowledge/cars.md"), "knowledge/cars.md");
        assert_eq!(normalize_ref_path("./knowledge/cars.md"), "knowledge/cars.md");
        assert_eq!(normalize_ref_path("knowledge\\cars.md"), "knowledge/cars.md");
        // One leading `./`, like the packer's `^\.\//` — not a loop.
        assert_eq!(normalize_ref_path(".././knowledge/cars.md"), ".././knowledge/cars.md");
    }

    #[test]
    fn teach_resolves_a_reference_written_with_a_leading_dot_slash() {
        // The packer accepts this form and bundles it under `knowledge/cars.md`, with no E018 and
        // no warning. Before the kernel normalized too, it packed clean and arrived content: null.
        let dsl = "state init\n  teach \"./knowledge/cars.md\"\n  interact\n";
        let mut k = AgentDSLKernel::new();
        k.set_content_files(content_map(&[("knowledge/cars.md", "# Cars")]));

        let effects = k.load_behavior(dsl).expect("should load");

        let (text, content) = first_teach(&effects);
        assert_eq!(content, Some("# Cars"), "the lookup key must be normalized as the packer does");
        assert_eq!(text, "./knowledge/cars.md", "the literal argument still survives untouched");
    }

    #[test]
    fn the_file_resolver_is_never_handed_inline_prose() {
        // A host resolver may touch the filesystem or answer permissively. Handing it a sentence
        // costs a lookup per prose statement per state entry, and invites a bogus `content`.
        use std::cell::RefCell;
        use std::rc::Rc;

        let dsl = concat!(
            "state init\n",
            "  guide \"Always confirm before proceeding.\"\n",
            "  teach \"Never guess a price.\"\n",
            "  teach \"knowledge/cars.md\"\n",
            "  interact\n",
        );
        let seen: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(Vec::new()));
        let recorder = Rc::clone(&seen);

        let mut k = AgentDSLKernel::new();
        k.set_file_resolver(Box::new(move |path: &str| {
            recorder.borrow_mut().push(path.to_string());
            Some("# Whatever the host had".to_string())
        }));

        let effects = k.load_behavior(dsl).expect("should load");

        assert_eq!(
            seen.borrow().as_slice(),
            ["knowledge/cars.md"],
            "only the .md reference may reach the resolver"
        );
        let (_, content) = first_guide(&effects);
        assert_eq!(content, None, "prose must not pick up whatever the resolver returns");
    }
}

