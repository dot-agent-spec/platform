/*
 * Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
