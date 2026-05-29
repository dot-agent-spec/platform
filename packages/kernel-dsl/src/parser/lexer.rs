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

#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    // Structure tokens
    Indent,
    Dedent,
    Newline,
    Eof,

    // Flow control
    KwMerge,
    KwState,
    KwOn,
    KwNext,
    KwIf,
    KwElse,
    KwAfter,
    KwParallel,

    // Statement keywords
    KwGoal,
    KwGuide,
    KwTeach,
    KwInteract,
    KwRun,
    KwSet,
    KwApply,
    KwRemove,

    // on-subtypes
    KwIntent,
    KwEscape,
    KwFallback,
    KwEvent,
    KwComplete,
    KwFailed,

    // run modifiers / kinds
    KwScript,
    KwSubagent,
    KwTool,
    KwSilent,
    KwIn,
    KwBackground,
    KwEach,

    // interact/after modifiers
    KwRequiring,
    KwPrompts,

    // apply/remove kinds
    KwCss,
    KwHtml,
    KwVideo,

    // memory domains
    KwContext,
    KwSession,
    KwWorksession,
    KwUser,

    // logical / boolean / null
    KwAnd,
    KwOr,
    KwTrue,
    KwFalse,
    KwNull,

    // Operators
    Assign,
    AddAssign,
    SubAssign,
    Eq,
    Ne,
    Gt,
    Lt,
    Gte,
    Lte,
    Dot,

    // Literals
    Str(String),
    Number(f64),
    Ident(String),
}

pub fn tokenize(text: &str) -> Vec<Token> {
    let mut tokens = Vec::new();
    let mut indent_stack: Vec<usize> = vec![0];

    for line in text.lines() {
        // count leading whitespace
        let stripped = line.trim_start_matches(|c: char| c == ' ' || c == '\t');

        // skip blank lines and comments
        if stripped.is_empty() || stripped.starts_with("//") {
            continue;
        }

        let indent = line.len() - stripped.len();
        let current = *indent_stack.last().unwrap();

        if indent > current {
            indent_stack.push(indent);
            tokens.push(Token::Indent);
        } else if indent < current {
            while *indent_stack.last().unwrap() > indent {
                indent_stack.pop();
                tokens.push(Token::Dedent);
            }
        }

        tokenize_line(stripped.as_bytes(), &mut tokens);
        tokens.push(Token::Newline);
    }

    // close any remaining open blocks
    while indent_stack.len() > 1 {
        indent_stack.pop();
        tokens.push(Token::Dedent);
    }

    tokens.push(Token::Eof);
    tokens
}

fn tokenize_line(bytes: &[u8], tokens: &mut Vec<Token>) {
    let len = bytes.len();
    let mut i = 0;

    while i < len {
        match bytes[i] {
            b' ' | b'\t' => i += 1,

            b'"' => {
                i += 1; // skip opening quote
                let start = i;
                while i < len {
                    if bytes[i] == b'\\' {
                        i += 2; // skip escape sequence
                    } else if bytes[i] == b'"' {
                        break;
                    } else {
                        i += 1;
                    }
                }
                let s = String::from_utf8_lossy(&bytes[start..i]).into_owned();
                if i < len { i += 1; } // skip closing quote
                tokens.push(Token::Str(s));
            }

            b'+' if i + 1 < len && bytes[i + 1] == b'=' => {
                tokens.push(Token::AddAssign);
                i += 2;
            }

            b'-' if i + 1 < len && bytes[i + 1] == b'=' => {
                tokens.push(Token::SubAssign);
                i += 2;
            }

            b'-' if i + 1 < len && bytes[i + 1].is_ascii_digit() => {
                let start = i;
                i += 1;
                while i < len && (bytes[i].is_ascii_digit() || bytes[i] == b'.') {
                    i += 1;
                }
                let s = std::str::from_utf8(&bytes[start..i]).unwrap_or("0");
                if let Ok(n) = s.parse::<f64>() {
                    tokens.push(Token::Number(n));
                }
            }

            b'=' if i + 1 < len && bytes[i + 1] == b'=' => {
                tokens.push(Token::Eq);
                i += 2;
            }
            b'=' => { tokens.push(Token::Assign); i += 1; }

            b'!' if i + 1 < len && bytes[i + 1] == b'=' => {
                tokens.push(Token::Ne);
                i += 2;
            }

            b'>' if i + 1 < len && bytes[i + 1] == b'=' => {
                tokens.push(Token::Gte);
                i += 2;
            }
            b'>' => { tokens.push(Token::Gt); i += 1; }

            b'<' if i + 1 < len && bytes[i + 1] == b'=' => {
                tokens.push(Token::Lte);
                i += 2;
            }
            b'<' => { tokens.push(Token::Lt); i += 1; }

            b'.' => { tokens.push(Token::Dot); i += 1; }

            b if b.is_ascii_digit() => {
                let start = i;
                while i < len && (bytes[i].is_ascii_digit() || bytes[i] == b'.') {
                    i += 1;
                }
                let s = std::str::from_utf8(&bytes[start..i]).unwrap_or("0");
                if let Ok(n) = s.parse::<f64>() {
                    tokens.push(Token::Number(n));
                }
            }

            b if b.is_ascii_alphabetic() || b == b'_' => {
                let start = i;
                i += 1;
                while i < len {
                    let c = bytes[i];
                    if c.is_ascii_alphanumeric() || c == b'_' {
                        i += 1;
                    } else if c == b'-'
                        && i + 1 < len
                        && (bytes[i + 1].is_ascii_alphanumeric() || bytes[i + 1] == b'_')
                    {
                        // hyphen inside identifier (e.g. has-context)
                        i += 1;
                    } else {
                        break;
                    }
                }
                let word = std::str::from_utf8(&bytes[start..i]).unwrap_or("");
                tokens.push(keyword_or_ident(word));
            }

            _ => i += 1,
        }
    }
}

fn keyword_or_ident(word: &str) -> Token {
    match word {
        "merge"      => Token::KwMerge,
        "state"      => Token::KwState,
        "on"         => Token::KwOn,
        "next"       => Token::KwNext,
        "if"         => Token::KwIf,
        "else"       => Token::KwElse,
        "after"      => Token::KwAfter,
        "parallel"   => Token::KwParallel,
        "goal"       => Token::KwGoal,
        "guide"      => Token::KwGuide,
        "teach"      => Token::KwTeach,
        "interact"   => Token::KwInteract,
        "run"        => Token::KwRun,
        "set"        => Token::KwSet,
        "apply"      => Token::KwApply,
        "remove"     => Token::KwRemove,
        "intent"     => Token::KwIntent,
        "escape"     => Token::KwEscape,
        "fallback"   => Token::KwFallback,
        "event"      => Token::KwEvent,
        "complete"   => Token::KwComplete,
        "failed"     => Token::KwFailed,
        "script"     => Token::KwScript,
        "subagent"   => Token::KwSubagent,
        "tool"       => Token::KwTool,
        "silent"     => Token::KwSilent,
        "in"         => Token::KwIn,
        "background" => Token::KwBackground,
        "each"       => Token::KwEach,
        "requiring"  => Token::KwRequiring,
        "prompts"    => Token::KwPrompts,
        "css"        => Token::KwCss,
        "html"       => Token::KwHtml,
        "video"      => Token::KwVideo,
        "context"    => Token::KwContext,
        "session"    => Token::KwSession,
        "worksession"=> Token::KwWorksession,
        "user"       => Token::KwUser,
        "and"        => Token::KwAnd,
        "or"         => Token::KwOr,
        "true"       => Token::KwTrue,
        "false"      => Token::KwFalse,
        "null"       => Token::KwNull,
        _            => Token::Ident(word.to_string()),
    }
}
