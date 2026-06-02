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

pub mod ast;
pub mod lexer;

use ast::*;
use lexer::{tokenize, Token};

#[derive(Debug)]
pub struct ParseError(pub String);

impl ParseError {
    fn new(msg: impl Into<String>) -> Self {
        ParseError(msg.into())
    }
}

struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    fn new(tokens: Vec<Token>) -> Self {
        Parser { tokens, pos: 0 }
    }

    fn peek(&self) -> &Token {
        self.tokens.get(self.pos).unwrap_or(&Token::Eof)
    }

    fn peek_at(&self, offset: usize) -> &Token {
        self.tokens.get(self.pos + offset).unwrap_or(&Token::Eof)
    }

    fn advance(&mut self) -> &Token {
        let t = self.tokens.get(self.pos).unwrap_or(&Token::Eof);
        self.pos += 1;
        t
    }

    fn skip_newlines(&mut self) {
        while matches!(self.peek(), Token::Newline) {
            self.advance();
        }
    }

    fn expect_newline(&mut self) {
        while matches!(self.peek(), Token::Newline) {
            self.advance();
        }
    }

    fn at_eof(&self) -> bool {
        matches!(self.peek(), Token::Eof)
    }

    fn is_domain(tok: &Token) -> bool {
        matches!(
            tok,
            Token::KwContext | Token::KwSession | Token::KwWorksession | Token::KwUser
        )
    }

    fn token_to_domain(tok: &Token) -> Option<MemoryDomain> {
        match tok {
            Token::KwContext    => Some(MemoryDomain::Context),
            Token::KwSession    => Some(MemoryDomain::Session),
            Token::KwWorksession => Some(MemoryDomain::WorkSession),
            Token::KwUser       => Some(MemoryDomain::User),
            _ => None,
        }
    }

    // Parse a dotted path starting from current position.
    // Accepts Ident tokens and domain keywords as path segments separated by Dot.
    fn parse_path(&mut self) -> String {
        let mut parts = Vec::new();
        parts.push(self.parse_ident_or_keyword_as_string());
        while matches!(self.peek(), Token::Dot) {
            self.advance(); // consume Dot
            parts.push(self.parse_ident_or_keyword_as_string());
        }
        parts.join(".")
    }

    // Consume and stringify the current token as an identifier segment.
    // Accepts Ident and any keyword that can appear in a dotted path.
    fn parse_ident_or_keyword_as_string(&mut self) -> String {
        let tok = self.advance().clone();
        match tok {
            Token::Ident(s)      => s,
            Token::KwContext     => "context".into(),
            Token::KwSession     => "session".into(),
            Token::KwWorksession => "worksession".into(),
            Token::KwUser        => "user".into(),
            Token::KwScript      => "script".into(),
            Token::KwSubagent    => "subagent".into(),
            Token::KwTool        => "tool".into(),
            Token::KwState       => "state".into(),
            Token::KwOn          => "on".into(),
            Token::KwTo          => "to".into(),
            Token::KwGoal        => "goal".into(),
            Token::KwGuide       => "guide".into(),
            Token::KwTeach       => "teach".into(),
            Token::KwRun         => "run".into(),
            Token::KwSet         => "set".into(),
            Token::KwComplete    => "complete".into(),
            Token::KwFailed      => "failed".into(),
            other => format!("{:?}", other),
        }
    }

    // Parse a value: Path, Str, Number, Bool, Null.
    fn parse_value(&mut self) -> Value {
        match self.peek().clone() {
            Token::Str(s) => { self.advance(); Value::Str(s) }
            Token::Number(n) => { self.advance(); Value::Number(n) }
            Token::KwTrue => { self.advance(); Value::Bool(true) }
            Token::KwFalse => { self.advance(); Value::Bool(false) }
            Token::KwNull => { self.advance(); Value::Null }
            _ => {
                // treat as path (ident or domain.key)
                Value::Path(self.parse_path())
            }
        }
    }

    // Parse comparison op from current position.
    fn parse_compare_op(&mut self) -> Option<CompareOp> {
        let op = match self.peek() {
            Token::Eq  => Some(CompareOp::Eq),
            Token::Ne  => Some(CompareOp::Ne),
            Token::Gt  => Some(CompareOp::Gt),
            Token::Lt  => Some(CompareOp::Lt),
            Token::Gte => Some(CompareOp::Gte),
            Token::Lte => Some(CompareOp::Lte),
            _ => None,
        };
        if op.is_some() { self.advance(); }
        op
    }

    // Parse a single expression (value optionally followed by compare op + value).
    fn parse_expr(&mut self) -> Expr {
        let left = self.parse_value();
        if let Some(op) = self.parse_compare_op() {
            let right = self.parse_value();
            Expr::Compare { left, op, right }
        } else {
            Expr::Value(left)
        }
    }

    // Parse a condition: expr (and|or expr)*.
    // Stops at Newline or Indent.
    fn parse_condition(&mut self) -> Condition {
        let mut parts: Vec<(Option<LogicalOp>, Expr)> = Vec::new();
        parts.push((None, self.parse_expr()));

        loop {
            match self.peek() {
                Token::KwAnd => {
                    self.advance();
                    parts.push((Some(LogicalOp::And), self.parse_expr()));
                }
                Token::KwOr => {
                    self.advance();
                    parts.push((Some(LogicalOp::Or), self.parse_expr()));
                }
                _ => break,
            }
        }

        Condition { parts }
    }

    // Parse assign op.
    fn parse_assign_op(&mut self) -> Result<AssignOp, ParseError> {
        match self.peek() {
            Token::Assign    => { self.advance(); Ok(AssignOp::Assign) }
            Token::AddAssign => { self.advance(); Ok(AssignOp::AddAssign) }
            Token::SubAssign => { self.advance(); Ok(AssignOp::SubAssign) }
            other => Err(ParseError::new(format!(
                "expected assignment operator, got {:?}", other
            ))),
        }
    }

    // Parse an indented block of statements.
    // Expects Indent, reads until matching Dedent.
    fn parse_block(&mut self) -> Result<Vec<Statement>, ParseError> {
        if !matches!(self.peek(), Token::Indent) {
            return Err(ParseError::new("expected indented block"));
        }
        self.advance(); // consume Indent

        let mut stmts = Vec::new();
        loop {
            self.skip_newlines();
            if matches!(self.peek(), Token::Dedent | Token::Eof) {
                break;
            }
            stmts.push(self.parse_statement()?);
        }

        if matches!(self.peek(), Token::Dedent) {
            self.advance(); // consume Dedent
        }

        Ok(stmts)
    }

    // Parse a run statement: run script|subagent|tool "target" ["label"] [silent|in background] [each path]
    fn parse_run(&mut self) -> Result<Statement, ParseError> {
        let kind = match self.peek() {
            Token::KwScript   => { self.advance(); RunKind::Script }
            Token::KwSubagent => { self.advance(); RunKind::Subagent }
            Token::KwTool     => { self.advance(); RunKind::Tool }
            other => return Err(ParseError::new(format!(
                "expected script|subagent|tool after run, got {:?}", other
            ))),
        };

        let target = match self.peek().clone() {
            Token::Str(s) => { self.advance(); s }
            other => return Err(ParseError::new(format!(
                "expected string target after run kind, got {:?}", other
            ))),
        };

        // optional label string
        let label = if let Token::Str(s) = self.peek().clone() {
            self.advance();
            Some(s)
        } else {
            None
        };

        // optional modifier: silent | in background
        let modifier = match self.peek() {
            Token::KwSilent => { self.advance(); Some(RunModifier::Silent) }
            Token::KwIn => {
                self.advance();
                if matches!(self.peek(), Token::KwBackground) {
                    self.advance();
                    Some(RunModifier::Background)
                } else {
                    None
                }
            }
            _ => None,
        };

        // optional: each path (experimental)
        let each = if matches!(self.peek(), Token::KwEach) {
            self.advance();
            Some(self.parse_path())
        } else {
            None
        };

        self.expect_newline();

        Ok(Statement::Run(RunStmt { kind, target, label, modifier, each }))
    }

    // Parse set statement: set domain.key op expr
    fn parse_set(&mut self) -> Result<Statement, ParseError> {
        let domain = match Self::token_to_domain(self.peek()) {
            Some(d) => { self.advance(); d }
            None => return Err(ParseError::new(format!(
                "expected memory domain (context|session|worksession|user), got {:?}",
                self.peek()
            ))),
        };

        if !matches!(self.peek(), Token::Dot) {
            return Err(ParseError::new("expected '.' after memory domain"));
        }
        self.advance(); // consume Dot

        // parse the key (may be dotted for nested keys)
        let mut key_parts = vec![self.parse_ident_or_keyword_as_string()];
        while matches!(self.peek(), Token::Dot) {
            self.advance();
            key_parts.push(self.parse_ident_or_keyword_as_string());
        }
        let key = key_parts.join(".");

        let op = self.parse_assign_op()?;
        let value = self.parse_expr();
        self.expect_newline();

        Ok(Statement::Set { path: MemoryPath { domain, key }, op, value })
    }

    // Parse on-variants: on intent|offtopic|fallback|event|complete|failed
    fn parse_on(&mut self) -> Result<Statement, ParseError> {
        match self.peek().clone() {
            Token::KwIntent => {
                self.advance();
                let intent = match self.peek().clone() {
                    Token::Str(s) => { self.advance(); s }
                    other => return Err(ParseError::new(format!(
                        "expected intent string, got {:?}", other
                    ))),
                };
                // inline form: on intent "X" transition to state
                if matches!(self.peek(), Token::KwTransition) {
                    self.advance();
                    if !matches!(self.peek(), Token::KwTo) {
                        return Err(ParseError::new("expected 'to' after 'transition'"));
                    }
                    self.advance();
                    let target = self.parse_path();
                    self.expect_newline();
                    return Ok(Statement::OnIntent {
                        intent,
                        body: IntentBody::Next(target),
                    });
                }
                // block form: on intent "X"\n  ...
                self.expect_newline();
                let body = self.parse_block()?;
                Ok(Statement::OnIntent { intent, body: IntentBody::Block(body) })
            }

            Token::KwOfftopic => {
                self.advance();
                self.expect_newline();
                let body = self.parse_block()?;
                Ok(Statement::OnOfftopic(body))
            }

            Token::KwFallback => {
                self.advance();
                self.expect_newline();
                let body = self.parse_block()?;
                Ok(Statement::OnFallback(body))
            }

            Token::KwComplete => {
                self.advance();
                self.expect_newline();
                let body = self.parse_block()?;
                Ok(Statement::OnComplete(body))
            }

            Token::KwFailed => {
                self.advance();
                self.expect_newline();
                let body = self.parse_block()?;
                Ok(Statement::OnFailed(body))
            }

            // on event "name" block — handled at top level, but can appear in blocks too
            Token::KwEvent => {
                self.advance();
                let event = match self.peek().clone() {
                    Token::Str(s) => { self.advance(); s }
                    other => return Err(ParseError::new(format!(
                        "expected event name string, got {:?}", other
                    ))),
                };
                self.expect_newline();
                let body = self.parse_block()?;
                // Wrap as a special intent trigger matching the event name
                Ok(Statement::OnIntent {
                    intent: format!("event:{}", event),
                    body: IntentBody::Block(body),
                })
            }

            other => Err(ParseError::new(format!(
                "expected intent|offtopic|fallback|event|complete|failed after on, got {:?}", other
            ))),
        }
    }

    // Parse if statement: if condition\n  block [else\n  block]
    fn parse_if(&mut self) -> Result<Statement, ParseError> {
        let condition = self.parse_condition();
        self.expect_newline();
        let then_body = self.parse_block()?;

        let else_body = if matches!(self.peek(), Token::KwElse) {
            self.advance();
            self.expect_newline();
            Some(self.parse_block()?)
        } else {
            None
        };

        Ok(Statement::If { condition, then_body, else_body })
    }

    // Parse after N prompts block
    fn parse_after(&mut self) -> Result<Statement, ParseError> {
        let prompts = match self.peek().clone() {
            Token::Number(n) => { self.advance(); n as u32 }
            other => return Err(ParseError::new(format!(
                "expected number after 'after', got {:?}", other
            ))),
        };

        if matches!(self.peek(), Token::KwPrompts) {
            self.advance();
        }
        self.expect_newline();
        let body = self.parse_block()?;

        Ok(Statement::After { prompts, body })
    }

    // Parse a single statement (does not skip leading newlines).
    fn parse_statement(&mut self) -> Result<Statement, ParseError> {
        match self.peek().clone() {
            Token::KwGoal => {
                self.advance();
                let text = match self.peek().clone() {
                    Token::Str(s) => { self.advance(); s }
                    other => return Err(ParseError::new(format!(
                        "expected string after goal, got {:?}", other
                    ))),
                };
                self.expect_newline();
                Ok(Statement::Goal(text))
            }

            Token::KwGuide => {
                self.advance();
                let text = match self.peek().clone() {
                    Token::Str(s) => { self.advance(); s }
                    other => return Err(ParseError::new(format!(
                        "expected string after guide, got {:?}", other
                    ))),
                };
                self.expect_newline();
                Ok(Statement::Guide(text))
            }

            Token::KwTeach => {
                self.advance();
                let text = match self.peek().clone() {
                    Token::Str(s) => { self.advance(); s }
                    other => return Err(ParseError::new(format!(
                        "expected string after teach, got {:?}", other
                    ))),
                };
                self.expect_newline();
                Ok(Statement::Teach(text))
            }

            Token::KwInteract => {
                self.advance();
                self.expect_newline();
                Ok(Statement::Interact)
            }

            Token::KwTransition => {
                self.advance();
                if !matches!(self.peek(), Token::KwTo) {
                    return Err(ParseError::new("expected 'to' after 'transition'"));
                }
                self.advance();
                let target = self.parse_path();
                self.expect_newline();
                Ok(Statement::Transition(target))
            }

            Token::KwOn => {
                self.advance();
                self.parse_on()
            }

            Token::KwRun => {
                self.advance();
                self.parse_run()
            }

            Token::KwSet => {
                self.advance();
                self.parse_set()
            }

            Token::KwIf => {
                self.advance();
                self.parse_if()
            }

            Token::KwAfter => {
                self.advance();
                self.parse_after()
            }

            Token::KwParallel => {
                self.advance();
                self.expect_newline();
                let body = self.parse_block()?;
                Ok(Statement::Parallel(body))
            }

            Token::KwApply => {
                self.advance();
                let kind = match self.peek() {
                    Token::KwCss   => { self.advance(); MediaKind::Css }
                    Token::KwHtml  => { self.advance(); MediaKind::Html }
                    Token::KwVideo => { self.advance(); MediaKind::Video }
                    other => return Err(ParseError::new(format!(
                        "expected css|html|video after apply, got {:?}", other
                    ))),
                };
                let value = match self.peek().clone() {
                    Token::Str(s) => { self.advance(); s }
                    other => return Err(ParseError::new(format!(
                        "expected string after apply kind, got {:?}", other
                    ))),
                };
                self.expect_newline();
                Ok(Statement::Apply { kind, value })
            }

            Token::KwRemove => {
                self.advance();
                let kind = match self.peek() {
                    Token::KwCss   => { self.advance(); MediaKind::Css }
                    Token::KwHtml  => { self.advance(); MediaKind::Html }
                    Token::KwVideo => { self.advance(); MediaKind::Video }
                    other => return Err(ParseError::new(format!(
                        "expected css|html|video after remove, got {:?}", other
                    ))),
                };
                let value = match self.peek().clone() {
                    Token::Str(s) => { self.advance(); s }
                    other => return Err(ParseError::new(format!(
                        "expected string after remove kind, got {:?}", other
                    ))),
                };
                self.expect_newline();
                Ok(Statement::Remove { kind, value })
            }

            // unknown token — skip the rest of the line to recover
            other => {
                let msg = format!("unexpected token in statement: {:?}", other);
                // consume until newline to recover
                while !matches!(self.peek(), Token::Newline | Token::Dedent | Token::Eof) {
                    self.advance();
                }
                self.skip_newlines();
                Err(ParseError::new(msg))
            }
        }
    }

    // Parse a global on event trigger at top level.
    fn parse_global_trigger(&mut self) -> Result<TriggerDecl, ParseError> {
        // already consumed 'on'
        if !matches!(self.peek(), Token::KwEvent) {
            return Err(ParseError::new("expected 'event' after top-level 'on'"));
        }
        self.advance();

        let event = match self.peek().clone() {
            Token::Str(s) => { self.advance(); s }
            other => return Err(ParseError::new(format!(
                "expected event name string, got {:?}", other
            ))),
        };

        self.expect_newline();
        let body = self.parse_block()?;
        Ok(TriggerDecl { event, body })
    }

    fn parse_state(&mut self) -> Result<StateDef, ParseError> {
        // already consumed 'state'
        let name = self.parse_path();
        self.expect_newline();

        let body = if matches!(self.peek(), Token::Indent) {
            self.parse_block()?
        } else {
            Vec::new()
        };

        Ok(StateDef { name, body })
    }

    fn parse_flow_file(&mut self) -> Result<FlowFile, ParseError> {
        let mut merges = Vec::new();
        let mut global_triggers = Vec::new();
        let mut states = Vec::new();

        loop {
            self.skip_newlines();
            if self.at_eof() { break; }

            match self.peek().clone() {
                Token::KwMerge => {
                    self.advance();
                    match self.peek().clone() {
                        Token::Str(s) => { self.advance(); merges.push(s); }
                        _ => {}
                    }
                    self.expect_newline();
                }

                Token::KwOn => {
                    self.advance();
                    // check if this is a global 'on event' or something else
                    if matches!(self.peek(), Token::KwEvent) {
                        match self.parse_global_trigger() {
                            Ok(trigger) => global_triggers.push(trigger),
                            Err(_) => { self.skip_to_next_top_level(); }
                        }
                    } else {
                        // unexpected at top level — skip
                        self.skip_to_next_top_level();
                    }
                }

                Token::KwState => {
                    self.advance();
                    match self.parse_state() {
                        Ok(state) => states.push(state),
                        Err(_) => { self.skip_to_next_top_level(); }
                    }
                }

                _ => {
                    // unknown top-level token — skip line
                    while !matches!(self.peek(), Token::Newline | Token::Eof) {
                        self.advance();
                    }
                }
            }
        }

        Ok(FlowFile { merges, global_triggers, states })
    }

    // Skip tokens until we reach a top-level state/on/merge declaration (no leading indent).
    fn skip_to_next_top_level(&mut self) {
        while !self.at_eof() {
            if matches!(self.peek(), Token::KwState | Token::KwMerge | Token::KwOn) {
                break;
            }
            self.advance();
        }
    }
}

pub fn parse_flow(text: &str) -> Result<FlowFile, ParseError> {
    let tokens = tokenize(text);
    let mut parser = Parser::new(tokens);
    parser.parse_flow_file()
}
