// Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct BehaviorFile {
    #[serde(default, rename = "merges")]
    pub merges: Vec<String>,
    #[serde(default, rename = "global_triggers")]
    pub global_triggers: Vec<TriggerDecl>,
    #[serde(default, rename = "states")]
    pub states: Vec<StateDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct TriggerDecl {
    pub event: String,
    pub body: Vec<Statement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct StateDef {
    pub name: String,
    pub body: Vec<Statement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Statement {
    #[serde(rename = "goal_stmt")]
    Goal { text: String },
    #[serde(rename = "guide_stmt")]
    Guide { text: String },
    #[serde(rename = "teach_stmt")]
    Teach { text: String },
    #[serde(rename = "interact_stmt")]
    Interact {
        #[serde(default)]
        handlers: Vec<Statement>,
    },
    #[serde(rename = "transition_stmt")]
    Transition {
        #[serde(rename = "state")]
        target: String,
    },
    #[serde(rename = "intent_trigger")]
    OnIntent { intent: String, body: IntentBody },
    #[serde(rename = "offtopic_stmt")]
    OnOfftopic { body: Vec<Statement> },
    #[serde(rename = "after_stmt")]
    After { prompts: u32, body: Vec<Statement> },
    #[serde(rename = "run_stmt")]
    Run(RunStmt),
    #[serde(rename = "memory_stmt")]
    Set {
        #[serde(rename = "target")]
        path: MemoryPath,
        #[serde(rename = "op")]
        op: AssignOp,
        #[serde(rename = "value")]
        value: Expr
    },
    #[serde(rename = "conditional_stmt")]
    If {
        condition: Condition,
        #[serde(rename = "then")]
        then_body: Vec<Statement>,
        #[serde(rename = "else")]
        else_body: Option<Vec<Statement>>
    },
    #[serde(rename = "apply_stmt")]
    Apply {
        #[serde(rename = "target")]
        kind: MediaKind,
        #[serde(rename = "text")]
        value: String,
    },
    #[serde(rename = "remove_stmt")]
    Remove {
        #[serde(rename = "target")]
        kind: MediaKind,
        #[serde(rename = "text")]
        value: String,
    },
    #[serde(rename = "parallel_stmt")]
    Parallel {
        body: Vec<Statement>,
        #[serde(default)]
        on_complete: Option<Vec<Statement>>,
        #[serde(default)]
        on_failed: Option<Vec<Statement>>,
    },
    #[serde(rename = "on_complete_stmt")]
    OnComplete { body: Vec<Statement> },
    #[serde(rename = "on_failed_stmt")]
    OnFailed { body: Vec<Statement> },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum IntentBody {
    Next(String),
    Block(Vec<Statement>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct RunStmt {
    pub kind: RunKind,
    pub target: String,
    pub label: Option<String>,
    pub modifier: Option<RunModifier>,
    pub each: Option<String>,
    #[serde(default)]
    pub on_failed: Option<Vec<Statement>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct MemoryPath {
    pub domain: MemoryDomain,
    pub key: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MemoryDomain {
    Context,
    Session,
    WorkSession,
    User,
}

impl MemoryDomain {
    pub fn as_str(&self) -> &'static str {
        match self {
            MemoryDomain::Context => "context",
            MemoryDomain::Session => "session",
            MemoryDomain::WorkSession => "worksession",
            MemoryDomain::User => "user",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunKind {
    Script,
    Subagent,
    Tool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RunModifier {
    Silent,
    Background,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AssignOp {
    #[serde(rename = "=")]
    Assign,
    #[serde(rename = "+=")]
    AddAssign,
    #[serde(rename = "-=")]
    SubAssign,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MediaKind {
    Css,
    Html,
    Video,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Condition {
    pub parts: Vec<(Option<LogicalOp>, Expr)>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LogicalOp {
    And,
    Or,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Expr {
    Value(Value),
    Compare { left: Value, op: CompareOp, right: Value },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CompareOp {
    #[serde(rename = "==")]
    Eq,
    #[serde(rename = "!=")]
    Ne,
    #[serde(rename = ">")]
    Gt,
    #[serde(rename = "<")]
    Lt,
    #[serde(rename = ">=")]
    Gte,
    #[serde(rename = "<=")]
    Lte,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum Value {
    Str(String),
    Number(f64),
    Bool(bool),
    Null,
    Path(String),
}
