// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0

// Parsing
export { initParsers, parse, parseSync, nodesOfType, nodeAtOffset, nodeToRange, positionToOffset, getContextNode } from './parser.js'

// Graph / SCXML
export { getBehaviorScxml } from './parser.js'

// DSL parsers
export { parseBehaviorFile, parseDescriptionFile, initBehaviorParser } from './parser.js'

// Linting
export { lintDescription, lintBehavior, createLinter } from './linter.js'

// Manifest (aboutme.json)
export { parseAboutme, buildAboutme, aboutmeToJson } from './manifest.js'

// Agent ID
export { parseId, buildId, extractDigest, extractName } from './id.js'

// ZIP utilities
export { readZip, writeZip, createZip, extractFiles, validateZipBomb, validateMagicBytes } from './zip.js'

// Pack pipeline
export { pack, collectFiles } from './pack.js'

// Types
export type {
  LangId,
  LintMessage,
  IdParts,
  Capability,
  AnnotatedRef,
  OntologyRef,
  PropertyType,
  PropertyDecl,
  TypeDefinition,
  AgentDecl,
  DescriptionFile,
  BehaviorFile,
  BehaviorStatement,
  StateDef,
  TriggerDecl,
  Integrity,
  AboutMe,
  PackOptions,
  PackResult,
  BuildAboutmeOptions,
} from './types.js'
