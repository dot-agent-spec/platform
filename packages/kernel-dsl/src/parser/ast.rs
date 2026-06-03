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

#[derive(Debug, Clone)]
pub struct BehaviorFile {
    pub merges: Vec<String>,
    pub global_triggers: Vec<TriggerDecl>,
    pub states: Vec<StateDef>,
}

#[derive(Debug, Clone)]
pub struct TriggerDecl {
    pub event: String,
    pub body: Vec<Statement>,
}

#[derive(Debug, Clone)]
pub struct StateDef {
    pub name: String,
    pub body: Vec<Statement>,
}

#[derive(Debug, Clone)]
pub enum Statement {
    Goal(String),
    Guide(String),
    Teach(String),
    Interact,
    Transition(String),
    OnIntent { intent: String, body: IntentBody },
    OnOfftopic(Vec<Statement>),
    OnFallback(Vec<Statement>),
    After { prompts: u32, body: Vec<Statement> },
    Run(RunStmt),
    Set { path: MemoryPath, op: AssignOp, value: Expr },
    If { condition: Condition, then_body: Vec<Statement>, else_body: Option<Vec<Statement>> },
    Apply { kind: MediaKind, value: String },
    Remove { kind: MediaKind, value: String },
    Parallel(Vec<Statement>),
    OnComplete(Vec<Statement>),
    OnFailed(Vec<Statement>),
}

#[derive(Debug, Clone)]
pub enum IntentBody {
    Next(String),
    Block(Vec<Statement>),
}

#[derive(Debug, Clone)]
pub struct RunStmt {
    pub kind: RunKind,
    pub target: String,
    pub label: Option<String>,
    pub modifier: Option<RunModifier>,
    pub each: Option<String>,
}

#[derive(Debug, Clone)]
pub struct MemoryPath {
    pub domain: MemoryDomain,
    pub key: String,
}

#[derive(Debug, Clone, PartialEq)]
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

#[derive(Debug, Clone)]
pub enum RunKind {
    Script,
    Subagent,
    Tool,
}

#[derive(Debug, Clone)]
pub enum RunModifier {
    Silent,
    Background,
}

#[derive(Debug, Clone)]
pub enum AssignOp {
    Assign,
    AddAssign,
    SubAssign,
}

#[derive(Debug, Clone)]
pub enum MediaKind {
    Css,
    Html,
    Video,
}

#[derive(Debug, Clone)]
pub struct Condition {
    pub parts: Vec<(Option<LogicalOp>, Expr)>,
}

#[derive(Debug, Clone)]
pub enum LogicalOp {
    And,
    Or,
}

#[derive(Debug, Clone)]
pub enum Expr {
    Value(Value),
    Compare { left: Value, op: CompareOp, right: Value },
}

#[derive(Debug, Clone)]
pub enum CompareOp {
    Eq,
    Ne,
    Gt,
    Lt,
    Gte,
    Lte,
}

#[derive(Debug, Clone)]
pub enum Value {
    Str(String),
    Number(f64),
    Bool(bool),
    Null,
    Path(String),
}
