// Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0

use crate::ast::{
    AgentDecl, AnnotatedRef, DescriptionFile, OntologyRef, PropertyDecl, PropertyType,
    TypeDefinition,
};
use crate::parser::ParseError;
use tree_sitter::{Node, Parser};

pub fn parse_description(text: &str) -> Result<DescriptionFile, ParseError> {
    let mut parser = Parser::new();
    parser
        .set_language(&dot_agent_tree_sitter::language_description())
        .map_err(|_| ParseError("Failed to load description language".to_string()))?;

    let normalized = if text.ends_with('\n') {
        text.to_string()
    } else {
        format!("{}\n", text)
    };
    let src = normalized.as_str();

    let tree = parser
        .parse(src, None)
        .ok_or_else(|| ParseError("Failed to parse description".to_string()))?;

    let root = tree.root_node();
    if root.has_error() {
        let msg = first_error_message(root, src);
        return Err(ParseError(msg));
    }

    let mut df = DescriptionFile {
        agent: AgentDecl {
            name: String::new(),
            domain: None,
            license: None,
            terms: None,
            privacy: None,
        },
        description: None,
        persona: None,
        behavior: None,
        requires: vec![],
        input: vec![],
        capabilities: vec![],
        output: vec![],
        types: vec![],
    };

    let mut cursor = root.walk();
    for child in root.children(&mut cursor) {
        // The grammar wraps top-level declarations in a `statement` node.
        let decl = if child.kind() == "statement" {
            child.named_child(0)
        } else {
            Some(child)
        };
        let Some(decl) = decl else { continue };
        match decl.kind() {
            "agent_decl" => parse_agent_decl(decl, src, &mut df),
            "type_decl" => {
                if let Some(td) = parse_type_decl(decl, src) {
                    df.types.push(td);
                }
            }
            _ => {}
        }
    }

    Ok(df)
}

// ── agent_decl ────────────────────────────────────────────────────────────────

fn parse_agent_decl(node: Node, src: &str, df: &mut DescriptionFile) {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "agent_name" => {
                df.agent.name = node_text(child, src)
                    .split_whitespace()
                    .collect::<Vec<_>>()
                    .join(" ");
            }
            "agent_meta" => parse_agent_meta(child, src, &mut df.agent),
            "description_block" => df.description = Some(parse_description_block(child, src)),
            "persona_block" => df.persona = child_field_text(child, "file", src),
            "behavior_block" => df.behavior = child_field_text(child, "file", src),
            "requires_block" => df.requires = parse_annotated_list(child, src),
            "input_block" => df.input = parse_type_list_block(child, src),
            "capabilities_block" => df.capabilities = parse_annotated_list(child, src),
            "output_block" => df.output = parse_type_list_block(child, src),
            _ => {}
        }
    }
}

fn parse_agent_meta(node: Node, src: &str, agent: &mut AgentDecl) {
    let key = child_field_text(node, "key", src).unwrap_or_default();
    // child_field_text already calls strip_quotes internally
    let value = child_field_text(node, "value", src);
    match key.as_str() {
        "domain" => agent.domain = value,
        "license" => agent.license = value,
        "terms" => agent.terms = value,
        "privacy" => agent.privacy = value,
        _ => {}
    }
}

fn parse_description_block(node: Node, src: &str) -> String {
    let mut lines = vec![];
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.kind() == "description_content" {
            let mut cc = child.walk();
            for line in child.children(&mut cc) {
                if line.kind() == "text_content" {
                    lines.push(node_text(line, src).to_string());
                }
            }
        }
    }
    lines.join("\n")
}

// ── annotated lists (requires, capabilities) ─────────────────────────────────

fn parse_annotated_list(node: Node, src: &str) -> Vec<AnnotatedRef> {
    let mut refs = vec![];
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "req_item" | "cap_item" => {
                if let Some(r) = parse_annotated_ref(child, src) {
                    refs.push(r);
                }
            }
            _ => {}
        }
    }
    refs
}

fn parse_annotated_ref(node: Node, src: &str) -> Option<AnnotatedRef> {
    let mut name = None;
    let mut description = None;
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "type_reference" => name = Some(parse_type_reference(child, src)),
            "quoted_string" => description = Some(strip_quotes(node_text(child, src))),
            _ => {}
        }
    }
    name.map(|n| AnnotatedRef { name: n, description })
}

// ── input / output blocks (inline or multiline) ───────────────────────────────

fn parse_type_list_block(node: Node, src: &str) -> Vec<AnnotatedRef> {
    let mut refs = vec![];
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            // multiline: typed_item children
            "typed_item" => {
                if let Some(r) = parse_annotated_ref(child, src) {
                    refs.push(r);
                }
            }
            // inline: direct type_reference children (comma-separated)
            "type_reference" => {
                refs.push(AnnotatedRef {
                    name: parse_type_reference(child, src),
                    description: None,
                });
            }
            _ => {}
        }
    }
    refs
}

// ── type_decl ─────────────────────────────────────────────────────────────────

fn parse_type_decl(node: Node, src: &str) -> Option<TypeDefinition> {
    let mut name = None;
    let mut category = None;
    let mut concept = None;
    let mut properties = vec![];

    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "identifier" if name.is_none() => name = Some(node_text(child, src).to_string()),
            "category_prop" => category = Some(parse_ontology_ref(child, src)),
            "concept_prop" => concept = Some(parse_ontology_ref(child, src)),
            "property_decl" => {
                if let Some(p) = parse_property_decl(child, src) {
                    properties.push(p);
                }
            }
            _ => {}
        }
    }

    Some(TypeDefinition {
        name: name?,
        category: category?,
        concept,
        properties,
    })
}

fn parse_ontology_ref(node: Node, src: &str) -> OntologyRef {
    let mut uri = String::new();
    let mut label = None;
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "url" => uri = node_text(child, src).to_string(),
            "ontology_label" => label = Some(node_text(child, src).to_string()),
            _ => {}
        }
    }
    OntologyRef { uri, label }
}

fn parse_property_decl(node: Node, src: &str) -> Option<PropertyDecl> {
    let mut name = None;
    let mut is_optional = false;
    let mut prop_type = None;
    let mut description = None;

    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        match child.kind() {
            "identifier" if name.is_none() => name = Some(node_text(child, src).to_string()),
            "optional_marker" => is_optional = true,
            "type_value" => prop_type = Some(parse_type_value(child, src)),
            "quoted_string" => description = Some(strip_quotes(node_text(child, src))),
            _ => {}
        }
    }

    Some(PropertyDecl {
        name: name?,
        r#type: prop_type?,
        is_optional,
        description,
    })
}

fn parse_type_value(node: Node, src: &str) -> PropertyType {
    let mut cursor = node.walk();
    let children: Vec<Node> = node.children(&mut cursor).collect();

    // Enum(...) — detected by first child being "Enum" keyword
    if children.first().map(|c| c.kind()) == Some("Enum") {
        let variants: Vec<String> = children
            .iter()
            .filter(|c| c.kind() == "identifier")
            .map(|c| node_text(*c, src).to_string())
            .collect();
        return PropertyType::Enum(variants);
    }

    // [TypeRef] — array
    let has_bracket = children.iter().any(|c| c.kind() == "[");
    if has_bracket {
        if let Some(ref_node) = children.iter().find(|c| c.kind() == "type_reference") {
            return PropertyType::Array(Box::new(PropertyType::Reference(
                parse_type_reference(*ref_node, src),
            )));
        }
    }

    // primitive_type (with or without annotation)
    if let Some(prim) = children.iter().find(|c| c.kind() == "primitive_type") {
        return PropertyType::Primitive(node_text(*prim, src).to_string());
    }

    // type_reference (namespace.Name or Name)
    if let Some(ref_node) = children.iter().find(|c| c.kind() == "type_reference") {
        return PropertyType::Reference(parse_type_reference(*ref_node, src));
    }

    PropertyType::Primitive("unknown".to_string())
}

// ── helpers ───────────────────────────────────────────────────────────────────

fn parse_type_reference(node: Node, src: &str) -> String {
    let mut cursor = node.walk();
    let parts: Vec<&str> = node
        .children(&mut cursor)
        .filter(|c| c.kind() == "identifier")
        .map(|c| &src[c.byte_range()])
        .collect();
    parts.join(".")
}

fn node_text<'a>(node: Node, src: &'a str) -> &'a str {
    &src[node.byte_range()]
}

fn child_field_text(node: Node, field: &str, src: &str) -> Option<String> {
    node.child_by_field_name(field)
        .map(|n| strip_quotes(node_text(n, src)))
}

fn strip_quotes(s: &str) -> String {
    if s.starts_with('"') && s.ends_with('"') && s.len() >= 2 {
        s[1..s.len() - 1]
            .replace("\\\"", "\"")
            .replace("\\\\", "\\")
    } else {
        s.to_string()
    }
}

fn first_error_message(node: Node, src: &str) -> String {
    let mut cursor = node.walk();
    for child in node.children(&mut cursor) {
        if child.is_error() || child.is_missing() {
            let pos = child.start_position();
            let line = src.lines().nth(pos.row).unwrap_or("");
            return format!(
                "Syntax error at line {}, column {}:\n  {}",
                pos.row + 1,
                pos.column + 1,
                line
            );
        }
        let msg = first_error_message(child, src);
        if !msg.is_empty() {
            return msg;
        }
    }
    String::new()
}
