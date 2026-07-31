// SPDX-License-Identifier: Apache-2.0

use tree_sitter::Language;
use tree_sitter::ffi::TSLanguage;

extern "C" {
    fn tree_sitter_description() -> *const TSLanguage;
    fn tree_sitter_behavior() -> *const TSLanguage;
}

/// Returns the tree-sitter [`Language`] for the description grammar
/// (`.description` / `.type` files).
pub fn language_description() -> Language {
    unsafe { Language::from_raw(tree_sitter_description()) }
}

/// Returns the tree-sitter [`Language`] for the behavior grammar
/// (`.behavior` files).
pub fn language_behavior() -> Language {
    unsafe { Language::from_raw(tree_sitter_behavior()) }
}

/// Node types for the behavior grammar as a JSON string.
pub const NODE_TYPES_BEHAVIOR: &str =
    include_str!("../../../tree-sitter-behavior/src/node-types.json");
