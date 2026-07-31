// SPDX-License-Identifier: Apache-2.0

// Browser-safe sub-path export — no Node.js dependencies.
// Import via: import { ... } from '@dot-agent/compiler/core'

export { parseAboutme, buildAboutme, aboutmeToJson } from './manifest.js'
export { parseId, buildId, extractDigest, extractName } from './id.js'
export { createZip, extractFiles, validateMagicBytes, validateZipBomb } from './zip-core.js'
export { CONTENT_NAMESPACES, isInContentNamespace, classifyContentPath } from './namespace.js'
export type { ContentNamespace } from './namespace.js'

export type {
  AboutMe,
  AgentBundle,
  AgentFiles,
  Capability,
  AnnotatedRef,
  DescriptionFile,
  Integrity,
  BuildAboutmeOptions,
  IdParts,
  LintMessage,
} from './types.js'
