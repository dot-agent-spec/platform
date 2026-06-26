// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

export type LangId = 'description' | 'behavior'

// ── Behavior DSL types ────────────────────────────────────────────────────────

export interface BehaviorStatement {
  type: string
  [key: string]: unknown
}

export interface StateDef {
  name: string
  body: BehaviorStatement[]
}

export interface TriggerDecl {
  event: string
  body: BehaviorStatement[]
}

export interface BehaviorFile {
  merges: string[]
  global_triggers: TriggerDecl[]
  states: StateDef[]
}

// ── Description DSL types ─────────────────────────────────────────────────────

export interface OntologyRef {
  uri: string
  label?: string
}

export interface AgentDecl {
  name: string
  domain?: string
  license?: string
  terms?: string
  privacy?: string
}

export interface AnnotatedRef {
  name: string
  description?: string
}

export type PropertyType =
  | { kind: 'primitive'; value: string }
  | { kind: 'reference'; value: string }
  | { kind: 'array'; value: PropertyType }
  | { kind: 'enum'; value: string[] }

export interface PropertyDecl {
  name: string
  type: PropertyType
  is_optional: boolean
  description?: string
}

export interface TypeDefinition {
  name: string
  category: OntologyRef
  concept?: OntologyRef
  properties: PropertyDecl[]
}

export interface DescriptionFile {
  agent: AgentDecl
  description?: string
  persona?: string
  behavior?: string
  requires: AnnotatedRef[]
  input: AnnotatedRef[]
  capabilities: AnnotatedRef[]
  output: AnnotatedRef[]
  types: TypeDefinition[]
}

// ── Shared toolchain types ────────────────────────────────────────────────────

/** Structured diagnostic from the Rust WASM parser. */
export interface ParseDiagnostic {
  severity: 'error' | 'warning' | 'info' | 'hint'
  code: string
  message: string
  hint?: string
  /** [line, col] 1-based, absent when position is unavailable (e.g. serde errors). */
  start?: [number, number]
  end?: [number, number]
}

export interface LintMessage {
  file: string
  line: number
  col: number
  severity: 'error' | 'warning' | 'info' | 'hint'
  code: string
  message: string
  hint?: string
}

export interface IdParts {
  namespace: string
  name: string
  version?: string
  digest?: string
}

export interface Capability {
  id: string
  description: string
}

export interface Integrity {
  sha256: string
  types?: string
  files?: string
}

export interface AboutMe {
  schemaVersion: string
  id: string
  name: string
  description: string
  version: string
  domain: string
  license: string
  persona: string
  purpose: string
  compiler: string
  commit?: string
  capabilities: Capability[]
  requires: AnnotatedRef[]
  integrity: Integrity
}

export interface PackOptions {
  dir?: string
  out?: string
  commit?: string
  version?: string
}

export interface PackResult {
  path: string
  id: string
  warnings: LintMessage[]
}

export interface BuildAboutmeOptions {
  id: string
  name: string
  description: string
  version: string
  domain: string
  license?: string
  persona: string
  purpose?: string
  compiler: string
  commit?: string
  capabilities?: Capability[]
  requires?: AnnotatedRef[]
  integrity: Integrity
}
