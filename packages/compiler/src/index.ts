// Copyright 2026 Danilo Borges
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Parsing
export { initParsers, parse, parseSync, nodesOfType, nodeAtOffset, nodeToRange, positionToOffset, getContextNode } from './parser.js'

// Graph / SCXML
export { getBehaviorScxml } from './parser.js'

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
  Skill,
  Integrity,
  AboutMe,
  ParsedDescription,
  PackOptions,
  PackResult,
  BuildAboutmeOptions,
} from './types.js'
