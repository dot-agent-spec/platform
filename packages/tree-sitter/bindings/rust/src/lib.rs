use tree_sitter::Language;
use tree_sitter::ffi::TSLanguage;

extern "C" {
    fn tree_sitter_agent() -> *const TSLanguage;
    fn tree_sitter_behavior() -> *const TSLanguage;
}

/// Returns the tree-sitter [`Language`] for the agent grammar
/// (`.description` / `.type` files).
pub fn language_agent() -> Language {
    unsafe { Language::from_raw(tree_sitter_agent()) }
}

/// Returns the tree-sitter [`Language`] for the behavior grammar
/// (`.behavior` files).
pub fn language_behavior() -> Language {
    unsafe { Language::from_raw(tree_sitter_behavior()) }
}

/// The content of the behavior grammar node types as a JSON string.
pub const NODE_TYPES_BEHAVIOR: &str = include_str!("../../../behavior/src/node-types.json");
