<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0002: Lib Format

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-17 |
| Author | Danilo Borges |
| Depends on | [RFC-0001: Addon Protocol](./0001-addon-protocol.md) |

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| ⚠️ | ⚠️ | ⚠️ | ⚠️ | ⚠️ |

---

## Summary

Define the format and protocol for **lib addons** — WASM executables that agents can call from within a flow as side-effecting operations. Libs extend an agent's capabilities (image processing, audio synthesis, ML inference, rendering) without changing the kernel or the flow logic.

---

## Motivation

Agents often need to perform operations that are outside the scope of an LLM call or a generic tool call — things like applying a visual filter, processing an audio buffer, or running a local ML model. These operations:

- Are **deterministic and self-contained** (no LLM involved)
- Benefit from **WASM portability** (run in browser, Electron, Node.js, and future runtimes)
- May require **GPU or audio APIs** from the host
- Should be **reusable across agents** (a filter lib authored once, used by many)

The `.behavior` DSL already has `run tool` and `run script` for external calls. Libs fill a different slot: **in-process WASM execution** with a defined interface, bundled or resolved at runtime.

---

## WASM Interface Contract

Every lib WASM module must export the following functions:

```rust
/// Invoke a method on this lib.
/// args_json: JSON-encoded arguments object
/// Returns: JSON-encoded result object, or a JSON error object
#[wasm_bindgen]
pub fn invoke(method: &str, args_json: &str) -> String

/// Returns the interface identifier this lib implements.
/// Example: "filter@1.0"
#[wasm_bindgen]
pub fn get_interface() -> String
```

The `invoke` function is the single entry point. All methods are dispatched through it. This keeps the WASM/JS boundary thin and uniform across all lib types.

### Error handling

If `invoke` fails, it must return a JSON error object:

```json
{ "error": { "code": "METHOD_NOT_FOUND", "message": "Method 'resize' is not supported" } }
```

The SDK treats any result with a top-level `error` key as a failure and feeds it back to the kernel as a failed effect.

---

## Standard Interface Catalog

The `interface` field in the addon declaration declares which protocol the lib implements. This allows the SDK and runtimes to know what methods to expect and what capabilities are required.

| Interface | Description | `requires` |
|---|---|---|
| `compute@1.0` | General CPU computation (hashing, encoding, compression) | — |
| `filter@1.0` | CPU-side image processing (resize, crop, color, encode) | — |
| `render@1.0` | GPU-accelerated rendering and visual effects | `host.webgpu` |
| `audio@1.0` | Audio DSP, synthesis, encoding | `host.webaudio` |
| `ml@1.0` | Local ML inference (ONNX, TFLite WASM backends) | — |
| `storage@1.0` | File and database I/O | `host.fs` |
| `network@1.0` | HTTP requests and webhooks | `host.fetch` |

Third-party libs may define their own interface identifiers outside this list. The platform only validates the contract (exports `invoke` and `get_interface`), not the semantics of unknown interfaces.

---

## Syntax in `.behavior`

Libs are called using the `run lib` statement, which follows the same pattern as `run tool` and `run script`:

```
// run lib name + method + with args
run lib "editavatar" "create"  '{ style: "ears", color: "brown" }'
set session.avatar = result
```

The first argument is the lib's local alias as declared in the manifest (the `name` segment of the addon ID). The `method` field maps to the first argument of `invoke`. The `with` block is serialized as JSON and passed as `args_json`.

The result is available as `result` in the immediately following `set` statement.

### Accessing the result in multiple statements

```
run lib "imagetools" method "resize" with { width: 512, height: 512 }
set session.thumbnail = result.url
```

---

## Effect Protocol

When the kernel encounters a `run lib` statement, it yields a `RunLib` effect:

```rust
pub enum Effect {
  // ...existing effects...
  RunLib {
    lib_id: String,      // local alias from manifest
    method: String,
    args: serde_json::Value,
  }
}
```

The SDK's `EffectHandler` resolves `RunLib` via the `LibResolver`:

```typescript
case 'RunLib': {
  const lib = await libResolver.resolve(effect.lib_id, manifest)
  const result = lib.invoke(effect.method, JSON.stringify(effect.args))
  const parsed = JSON.parse(result)
  if (parsed.error) throw new LibError(parsed.error)
  kernel.send_event('complete', parsed)
  break
}
```

---

## LibResolver

`LibResolver` extends the base `AddonResolver` from RFC-0001 and adds WASM instantiation:

```typescript
class LibResolver extends AddonResolver<WasmLib> {
  private instances = new Map<string, WasmLib>()

  async get(alias: string): Promise<WasmLib> {
    if (this.instances.has(alias)) return this.instances.get(alias)!
    const decl = this.manifest.addons.find(a => a.kind === 'lib' && nameOf(a.id) === alias)
    if (!decl) throw new Error(`Lib '${alias}' not declared in manifest`)
    const lib = await this.resolve(decl)
    this.instances.set(alias, lib)
    return lib
  }

  async instantiate(bytes: ArrayBuffer): Promise<WasmLib> {
    const module = await WebAssembly.compile(bytes)
    const instance = await WebAssembly.instantiate(module)
    return new WasmLib(instance)
  }
}

class WasmLib {
  constructor(private instance: WebAssembly.Instance) {}

  invoke(method: string, argsJson: string): string {
    return (this.instance.exports.invoke as Function)(method, argsJson)
  }

  getInterface(): string {
    return (this.instance.exports.get_interface as Function)()
  }
}
```

Lib instances are cached per agent session. WASM modules are instantiated once and reused across multiple `run lib` calls.

---

## CPU vs GPU-bound Libs

Lib authors must be explicit about GPU usage. A lib that uses WebGPU must:

1. Declare `"requires": ["host.webgpu"]` in the manifest
2. Accept a WebGPU device handle through the `invoke` interface when the method requires it

Example `render@1.0` lib invocation:

```
run lib "editavatar" method "applyShader" with { shader: "ears", intensity: 0.8 }
```

The SDK injects the WebGPU device into the WASM module during instantiation (via imports), before any `invoke` call. The lib never requests GPU access on its own — it is provided by the host at load time.

This keeps the capability check at the manifest level, not scattered across method calls.

---

## Packaging

During `dot-agent pack`, the compiler:

1. Reads each `lib` addon declared in the manifest
2. For `bundle` type: verifies the `.wasm` file exists and is a valid WebAssembly binary (magic bytes `\0asm`)
3. Copies it into the ZIP under `libs/<name>.wasm`
4. Does not validate the lib's internal logic or methods — only that it exports `invoke` and `get_interface`

---

## Standard Libs (Platform)

First-party libs are published as `@dot-agent/lib-*` packages in the monorepo under `packages/libs/`:

```
packages/
└── libs/
    ├── editavatar/    → @dot-agent/lib-editavatar (filter@1.0)
    ├── imagetools/    → @dot-agent/lib-imagetools  (filter@1.0)
    └── ...
```

These are authored in Rust and compiled to WASM. They can be referenced as `"type": "builtin"` in the manifest, meaning the SDK ships with them pre-installed and no bundling or network fetch is required.

---

## Open Questions

- **WASM Component Model:** should libs eventually use WIT (WebAssembly Interface Types) instead of the current JSON-over-strings protocol? WIT would give stronger typing but adds toolchain complexity.
- **Lib-to-lib calls:** can a lib call another lib? Currently no — libs are isolated WASM modules called only by the SDK effect handler.
- **Streaming results:** `invoke` currently returns a single JSON string. Should there be a streaming variant for audio/video output?

---

## Related RFCs

- [RFC-0001: Addon Protocol](./0001-addon-protocol.md) — base protocol (ID, resolution, capabilities)
- [RFC-0003: Knowledge Format](./0003-knowledge-format.md) — data addon protocol
