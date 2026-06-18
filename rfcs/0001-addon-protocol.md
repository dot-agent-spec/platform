<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0001: Addon Protocol

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-17 |
| Author | Danilo Borges |

---

## Summary

Define a unified protocol for all addon types in the dot-agent ecosystem — including **libs** (WASM executables), **knowledge** (data packages), and **custom kernels** — so that the compiler, SDK, and host runtimes share a consistent model for ID, resolution, integrity, and capabilities.

---

## Motivation

Three categories of addon have emerged from the architecture:

- **Kernel** — controls the agent's execution flow (one per agent)
- **Lib** — WASM executable called as an effect from within a flow (N per agent)
- **Knowledge** — data/expertise package queried at runtime (N per agent)

All three share the same structural concerns:

1. **Identity** — how to uniquely and verifiably name an addon
2. **Resolution** — where to find it (bundled in the `.agent` file, or fetched online)
3. **Integrity** — how to verify the artifact hasn't been tampered with
4. **Capabilities** — what host APIs the addon requires to function

Defining this base protocol once prevents each addon type from inventing its own incompatible conventions.

---

## Addon ID Format

Addon IDs follow the same pattern as agent IDs:

```
namespace/name@version~digest
```

| Segment | Description | Example |
|---|---|---|
| `namespace` | Domain from the author's `.description` | `danilo.dev` |
| `name` | Addon name, kebab-case | `editavatar` |
| `version` | SemVer | `1.2.0` |
| `digest` | SHA-256 of the artifact, hex-encoded | `sha256:abc123…` |

The `digest` segment is optional at authoring time but required when pinning a dependency for production use. When present, the runtime must verify the artifact before loading.

Examples:

```
danilo.dev/editavatar@1.2.0~sha256:3f4a…
britanica.com/encyclopedia@2025.1~sha256:9e1b…
dot-agent/behavior@0.1.3~sha256:7c2d…
```

The `dot-agent` namespace is reserved for first-party addons shipped with the platform (e.g., the built-in behavior kernel).

---

## Manifest Declaration

Addons are declared in `aboutme.json` under the `addons` field. The `kernel` field is a shorthand for a single addon of kind `kernel`.

```json
{
  "id": "danilo.dev/mickey@1.0.0",
  "kernel": {
    "kind": "kernel",
    "id": "dot-agent/behavior@0.1.3",
    "type": "builtin"
  },
  "addons": [
    {
      "kind": "lib",
      "id": "danilo.dev/editavatar@1.2.0~sha256:3f4a…",
      "type": "bundle",
      "file": "libs/editavatar.wasm",
      "interface": "filter@1.0",
      "requires": ["host.webgpu"]
    },
    {
      "kind": "knowledge",
      "id": "britanica.com/encyclopedia@2025.1~sha256:9e1b…",
      "type": "online",
      "url": "https://registry.dot-agent.io/addons/britanica.com/encyclopedia@2025.1",
      "integrity": "sha256:9e1b…",
      "interface": "knowledge@1.0"
    }
  ]
}
```

### Field reference

| Field | Required | Description |
|---|---|---|
| `kind` | Yes | `kernel`, `lib`, or `knowledge` |
| `id` | Yes | Addon ID (namespace/name@version~digest) |
| `type` | Yes | `builtin`, `bundle`, or `online` |
| `file` | If `bundle` | Path within the `.agent` ZIP |
| `url` | If `online` | Canonical download URL |
| `integrity` | If `online` | SHA-256 of the artifact for verification |
| `interface` | Yes | The protocol the addon implements (e.g., `filter@1.0`) |
| `requires` | No | List of host capabilities required |

---

## Resolution Types

### `builtin`

The addon is part of the SDK's built-in set. The runtime resolves it locally without any bundling or network access.

```json
{ "type": "builtin", "id": "dot-agent/behavior@0.1.3" }
```

Used for: the default behavior kernel; standard platform libs shipped with the SDK.

### `bundle`

The addon artifact is included in the `.agent` ZIP file under the declared `file` path.

```json
{ "type": "bundle", "file": "libs/editavatar.wasm" }
```

The `.agent` ZIP structure:

```
myagent.agent (ZIP)
├── aboutme.json
├── main.behavior
└── libs/
    └── editavatar.wasm
```

### `online`

The addon is fetched at runtime from a URL. The `integrity` field is mandatory and the runtime must reject the artifact if the hash does not match.

```json
{
  "type": "online",
  "url": "https://registry.dot-agent.io/addons/britanica.com/encyclopedia@2025.1",
  "integrity": "sha256:9e1b…"
}
```

Runtimes may cache online addons locally. The cache key is the full addon ID including digest.

---

## Capabilities (`requires`)

Some addons require host APIs that are not universally available. The `requires` field declares these dependencies so the runtime can verify compatibility before loading.

| Capability | Description |
|---|---|
| `host.webgpu` | WebGPU API (GPU compute and rendering) |
| `host.webaudio` | Web Audio API (audio DSP and synthesis) |
| `host.fs` | Filesystem access |
| `host.fetch` | Network fetch (HTTP) |
| `host.ipc` | Inter-process communication |

A runtime that cannot satisfy a required capability must refuse to load the agent with a clear error, rather than loading it in a degraded state.

Addons with no `requires` field are considered universally portable.

---

## AddonResolver (SDK)

The SDK exposes a base `AddonResolver` that handles the resolution logic common to all addon kinds. Specific resolvers (`LibResolver`, `KnowledgeResolver`) extend it.

```typescript
interface AddonDeclaration {
  kind: 'kernel' | 'lib' | 'knowledge'
  id: string
  type: 'builtin' | 'bundle' | 'online'
  file?: string
  url?: string
  integrity?: string
  interface: string
  requires?: string[]
}

abstract class AddonResolver<T> {
  constructor(
    private bundle: AgentBundle,
    private hostCapabilities: string[]
  ) {}

  async resolve(decl: AddonDeclaration): Promise<T> {
    this.checkCapabilities(decl)

    if (decl.type === 'builtin') return this.loadBuiltin(decl)
    if (decl.type === 'bundle') return this.loadBundle(decl)
    if (decl.type === 'online') return this.loadOnline(decl)
  }

  private checkCapabilities(decl: AddonDeclaration) {
    for (const cap of decl.requires ?? []) {
      if (!this.hostCapabilities.includes(cap)) {
        throw new Error(`Agent requires ${cap} but host does not provide it`)
      }
    }
  }

  private async loadOnline(decl: AddonDeclaration): Promise<T> {
    const bytes = await fetch(decl.url!)
    await verifyIntegrity(bytes, decl.integrity!)
    return this.instantiate(bytes, decl)
  }

  abstract loadBuiltin(decl: AddonDeclaration): Promise<T>
  abstract loadBundle(decl: AddonDeclaration): Promise<T>
  abstract instantiate(bytes: ArrayBuffer, decl: AddonDeclaration): Promise<T>
}
```

---

## Compiler Responsibilities

When running `dot-agent pack`, the compiler:

1. Reads `addons[]` from the manifest source
2. For each `bundle` addon: verifies the file exists and is a valid artifact (WASM binary for libs/kernels)
3. For each `online` addon: verifies `integrity` is present
4. Copies `bundle` artifacts into the ZIP under their declared `file` paths
5. Does **not** validate the semantics of custom kernel or lib internals — only structural integrity

---

## Open Questions

- **Registry governance:** who can publish to the default registry? Should there be a signed author model?
- **Kernel online resolution:** currently kernels are `builtin` or `bundle` only. Should online kernels be allowed in future? (Security concern: kernels have full execution control.)
- **Addon versioning across agents:** if two agents in a session use `editavatar@1.2.0` and `editavatar@1.3.0`, should the runtime deduplicate by major version?

---

## Related RFCs

- [RFC-0002: Lib Format](./0002-lib-format.md) — protocol for WASM executable addons
- [RFC-0003: Knowledge Format](./0003-knowledge-format.md) — protocol for data/expertise addons
