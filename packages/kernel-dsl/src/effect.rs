// SPDX-License-Identifier: Apache-2.0

use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Effect {
    Goal { text: String },
    Guide { text: String },
    Teach { text: String },
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
