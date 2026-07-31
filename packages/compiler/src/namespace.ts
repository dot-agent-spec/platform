// SPDX-License-Identifier: Apache-2.0

// The two directories the runtime can actually serve content from: pack.ts's
// collectFiles() bundles a guide/teach reference at its literal path, but
// bundle.ts, sdk/load.ts, and the CLI's MCP resource handlers each classify a
// bundled file into guides/knowledge purely by this prefix — a reference
// resolving outside them is bundled but unreachable (see pack.ts's W016).
// Single source of truth so the three sites can't drift on the prefix list.
export const CONTENT_NAMESPACES = ['guides', 'knowledge'] as const
export type ContentNamespace = (typeof CONTENT_NAMESPACES)[number]

export function isInContentNamespace(bundlePath: string): boolean {
  return classifyContentPath(bundlePath) !== null
}

export function classifyContentPath(bundlePath: string): ContentNamespace | null {
  return CONTENT_NAMESPACES.find(ns => bundlePath.startsWith(`${ns}/`)) ?? null
}
