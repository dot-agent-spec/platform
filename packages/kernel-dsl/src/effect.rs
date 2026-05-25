use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Effect {
    Goal { text: String },
    Guide { text: String },
    Teach { text: String },
    RequestInteract { requiring: Option<String> },
    Transition { from: String, to: String },
    RunScript { target: String, label: Option<String>, silent: bool },
    RunSubagent { target: String, label: Option<String>, background: bool },
    RunTool { target: String, label: Option<String> },
    SetMemory { domain: String, key: String, value: MemValue },
    ApplyCss { value: String },
    RemoveCss { value: String },
    ApplyHtml { value: String },
    RemoveHtml { value: String },
    ApplyVideo { value: String },
    RemoveVideo { value: String },
    ParseError { message: String },
}

/// A serializable primitive value used in SetMemory effects.
#[derive(Debug, Clone, Serialize)]
#[serde(untagged)]
pub enum MemValue {
    Str(String),
    Num(f64),
    Bool(bool),
    Null,
}
