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
use ts_rs::TS;

// ── Description DSL types ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct OntologyRef {
    pub uri: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AgentDecl {
    pub name: String,
    pub domain: Option<String>,
    pub license: Option<String>,
    pub terms: Option<String>,
    pub privacy: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct AnnotatedRef {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct TypeDefinition {
    pub name: String,
    pub category: OntologyRef,
    pub concept: Option<OntologyRef>,
    pub properties: Vec<PropertyDecl>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct PropertyDecl {
    pub name: String,
    pub r#type: PropertyType,
    pub is_optional: bool,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(tag = "kind", content = "value", rename_all = "snake_case")]
pub enum PropertyType {
    Primitive(String),
    // Namespace-qualified refs (e.g. std.Prompt) are concatenated by the parser.
    Reference(String),
    Array(Box<PropertyType>),
    Enum(Vec<String>),
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub struct DescriptionFile {
    pub agent: AgentDecl,
    pub description: Option<String>,
    /// File reference, e.g. "SOUL.md"
    pub persona: Option<String>,
    /// File reference, e.g. "agent.behavior"
    pub behavior: Option<String>,
    #[serde(default)]
    pub requires: Vec<AnnotatedRef>,
    #[serde(default)]
    pub input: Vec<AnnotatedRef>,
    #[serde(default)]
    pub capabilities: Vec<AnnotatedRef>,
    #[serde(default)]
    pub output: Vec<AnnotatedRef>,
    #[serde(default)]
    pub types: Vec<TypeDefinition>,
}

// ── Behavior DSL types ────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub struct BehaviorFile {
    #[serde(default, rename = "merges")]
    pub merges: Vec<String>,
    #[serde(default, rename = "global_triggers")]
    pub global_triggers: Vec<TriggerDecl>,
    #[serde(default, rename = "states")]
    pub states: Vec<StateDef>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub struct TriggerDecl {
    pub event: String,
    pub body: Vec<Statement>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub struct StateDef {
    pub name: String,
    pub body: Vec<Statement>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
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
    #[serde(rename = "intent_handler")]
    OnIntent { intent: String, body: IntentBody },
    #[serde(rename = "offtopic_handler")]
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
        #[serde(default)]
        on_failure: Option<Vec<Statement>>,
    },
    #[serde(rename = "remove_stmt")]
    Remove {
        #[serde(rename = "target")]
        kind: MediaKind,
        #[serde(rename = "text")]
        value: String,
        #[serde(default)]
        on_failure: Option<Vec<Statement>>,
    },
    #[serde(rename = "parallel_stmt")]
    Parallel {
        body: Vec<Statement>,
        #[serde(default)]
        on_failure: Option<Vec<Statement>>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(untagged)]
pub enum IntentBody {
    Next(String),
    Block(Vec<Statement>),
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub struct RunStmt {
    pub kind: RunKind,
    pub target: String,
    pub parameters: Option<String>,
    pub modifier: Option<RunModifier>,
    #[serde(default)]
    pub on_failure: Option<Vec<Statement>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub struct MemoryPath {
    pub domain: MemoryDomain,
    pub key: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[ts(export)]
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

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum RunKind {
    Script,
    Subagent,
    Tool,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum RunModifier {
    Silent,
    Background,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum AssignOp {
    #[serde(rename = "=")]
    Assign,
    #[serde(rename = "+=")]
    AddAssign,
    #[serde(rename = "-=")]
    SubAssign,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum MediaKind {
    Css,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct Condition {
    pub parts: Vec<(Option<LogicalOp>, Expr)>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(rename_all = "snake_case")]
pub enum LogicalOp {
    And,
    Or,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(untagged)]
pub enum Expr {
    Value(Value),
    Compare { left: Value, op: CompareOp, right: Value },
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
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

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[serde(untagged)]
pub enum Value {
    Str(String),
    Number(f64),
    Bool(bool),
    Null,
    Path(String),
}
