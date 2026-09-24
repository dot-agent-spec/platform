// SPDX-License-Identifier: Apache-2.0

use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Effect {
    Goal { text: String },
    /// `text` is the literal argument written in the DSL, always preserved. When it names a file
    /// the host handed to `set_content_files`, `content` carries that file's text; otherwise
    /// `content` is `None` and the consumer keeps treating `text` as prose, or as a path it
    /// fetches itself. The key is always serialized, so a host reads `content ?? text` without
    /// having to probe for its presence.
    Guide { text: String, content: Option<String> },
    /// `text` is the literal argument written in the DSL, always preserved; `content` is the
    /// bundled file's text when `text` names one. See [`Effect::Guide`] for why `text` is never
    /// replaced by the resolved content.
    Teach { text: String, content: Option<String> },
    RequestInteract,
    Transition { from: String, to: String },
    RunScript { target: String, parameters: Option<String>, silent: bool },
    RunSubagent { target: String, parameters: Option<String>, background: bool },
    RunTool { target: String, parameters: Option<String> },
    SetMemory { domain: String, key: String, value: MemValue },
    ApplyCss { value: String },
    RemoveCss { value: String },
    ParseError { message: String },
}

/// A serializable primitive value used in SetMemory effects.
#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(untagged)]
pub enum MemValue {
    Str(String),
    Num(f64),
    Bool(bool),
    Null,
}
