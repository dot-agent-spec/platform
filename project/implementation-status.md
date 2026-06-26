# Implementation Status

Caniuse-style tracking. Rows = DSL features (tree-sitter is the source of truth). Columns = packages in layer order.

Legend: 
☑️ verified ✅ implemented · ⚠️ partial or gap · ❌ missing, should exist · → re-exports or delegates · 🔄 `pkg` consumes from `pkg` · ➕ field/type injected at this layer (no upstream DSL source) · 📌 hardcoded value that should derive from the language  
🗑️ obsolete (POC nodes removed or renamed in grammar)

1️⃣ v0.1 · 2️⃣ v0.2 · 🗓️ TBD

---

## Package freeze status

| | tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|---|
| **Status** | 🧊 Frozen | 🔥 Active  | 🔥⚠️ Active | 🧊⚠️ Frozen | 🔥⚠️ Active |
| **Version** | `0.4.1` | `0.1.0` | `0.1.0` | `0.1.3` | `0.1.0` |
| **Build** | `tree-sitter-cli` — manual npm scripts (`generate` + `build --wasm`) | 🦀 `cargo` + `wasm-bindgen` + `wasi-stub` (`build-wasm.sh`, target `wasm32-wasip1`) | `tsup` (esm + cjs, `dts:true`) | 🦀 `cargo` + `wasm-bindgen` + `wasi-stub` + `patch-wasm-bindgen.js` | `tsup` (esm + cjs, `dts:true`) |
| **Exports** | npm (wasm file paths) · 🦀 rlib (via `cc`) | <img src="https://openmoji.org/data/color/svg/E06A.svg" alt="wasm" width="16"> wasm `cdylib` (npm) · 🦀 rlib | npm only (esm + cjs) | <img src="https://openmoji.org/data/color/svg/E06A.svg" alt="wasm" width="16"> wasm `cdylib` (npm) · 🦀 rlib | npm only (esm + cjs) |
| **Types (.d.ts)** | ❌ none (consumers type-assert) | ⚠️ hand-written stub (thin; no Rust structs) | ✅ `tsup` auto (full) | ⚠️ hand-written stub (thin); rich `pkg/*.d.ts` shadowed | ✅ `tsup` auto (full) |

> ⚠️ **Build / packaging gaps** — full catalog in [build-pipeline-investigation](../docs/explanation/research/build-pipeline-investigation.md):
> - Stale `wasm-pack` definitions in both Rust crates' `Cargo.toml` metadata — the real build is the shell script (`cargo + wasm-bindgen + wasi-stub`).
> - `build.rs` byte-identical across parser-dsl/kernel-dsl; wasm-bindgen patches and UBSan env-stubs duplicated 3× with different strategies.
> - kernel-dsl ships a second, unreferenced `pkg-web/` output (predates `pkg/`; maintained vs abandoned unconfirmed).
> - `wasm-bindgen`'s rich `.d.ts` exists in `pkg/` but is shadowed by the thinner hand-written `index.d.ts`.
> - Versions diverge: tree-sitter `0.4.1`, kernel-dsl `0.1.3`, others `0.1.0`.

---

## tree-sitter package (L0 -> L3)

| ☑️ tree-sitter | ☑️ parser-dsl | compiler | kernel-dsl | sdk | Notes |
|---|---|---|---|---|---|
| <img src="https://openmoji.org/data/color/svg/E06A.svg" alt="wasm" width="24"> @dot-agent/tree-sitter | - |🔄 dependency|---|---|---|
| 🦀 dot-agent-tree-sitter| 🔄 dependency |---|---|---|---|

| ☑️ tree-sitter | ☑️ parser-dsl | compiler | kernel-dsl | sdk | Notes |
|---|---|---|---|---|---|
| ✅1️⃣ `descriptionWasmPath: string` (js export) | | 🔄 `compiler` | | | `full.initParsers()` loads via `web-tree-sitter`; also for standalone editor extensions |
| ✅1️⃣ `behaviorWasmPath: string` (js export) | | 🔄 `compiler` | | | `full.initParsers()` loads via `web-tree-sitter`; also for standalone editor extensions |
| ✅1️⃣ 🦀 `language_description() → Language` (lib fn) | 🔄 `parser-dsl` | | 🔄 `kernel-dsl` | | `description_parser.rs` · direct dep in kernel-dsl `Cargo.toml` |
| ✅1️⃣ 🦀 `language_behavior() → Language` (lib fn) | 🔄 `parser-dsl` | | 🔄 `kernel-dsl` | | `parser.rs` · direct dep in kernel-dsl `Cargo.toml` |
| ✅1️⃣ 🦀 `NODE_TYPES_BEHAVIOR: &str` (lib const) | 🔄 `parser-dsl` | | 🔄 `kernel-dsl` | | build-time in parser-dsl `build.rs` · direct dep in kernel-dsl |
| ❌ `NODE_TYPES_DESCRIPTION` | | | | | absent from Rust lib |

---

## parser-dsl package (L1 -> L3)
| ☑️ tree-sitter | ☑️⚠️parser-dsl | compiler | kernel-dsl | sdk | Notes |
|---|---|---|---|---|---|
| - | ⚠️ not published <br> <img src="https://openmoji.org/data/color/svg/E06A.svg" alt="wasm" width="24"> @dot-agent/parser-dsl |---|---|---|---|
| 🔄 dependency | ⚠️ local <br> ⚠️ 🦀 not published |---|---|---|---|

| ☑️✅ parser-dsl | compiler | kernel-dsl | sdk | Notes |
|---|---|---|---|---|
| ✅1️⃣ `init()` → `Promise<void>` (wasm fn) | → `full.initParsers()` | | | must call before any other wasm fn |
| ✅1️⃣ `parse_description(text)` → `string` (wasm fn) | → `full.parseDescriptionFile(text)` | | | JSON `{ok: DescriptionFile \| null, diagnostics: ParseDiagnostic[]}` — DA01-01 breaking change |
| ✅1️⃣ `parse_behavior(text)` → `string` (wasm fn) | → `full.parseBehaviorFile(text)` | | | JSON `{ok: BehaviorFile \| null, diagnostics: ParseDiagnostic[]}` — DA01-01 breaking change |
| ✅1️⃣ `get_graph(text)` → `string` (wasm fn) | → `full.getBehaviorScxml(text)` | | | W3C SCXML XML; static (no `_active` annotation) |
| ✅1️⃣ `get_states(text)` → `string` (wasm fn) | | | | JSON `string[]` in declaration order |
| ✅1️⃣ `get_intents_for_state(text, state)` → `string` (wasm fn) | | | | JSON `string[]`; empty if state not found |
| ✅1️⃣ `parse_behavior(text)` → `Result<BehaviorFile, ParseError>` (rust lib fn) | | 🔄 `kernel-dsl` | | crate linkage — called directly by `load_behavior` |
| ✅1️⃣ `parse_description(text)` → `Result<DescriptionFile, ParseError>` (rust lib fn) | | 🔄 `kernel-dsl` | | crate linkage |
| ✅1️⃣ `mod ast` (rust lib) | | 🔄 `kernel-dsl` | | `BehaviorFile`, `DescriptionFile`, `StateDef`, `Statement`, … all serde-tagged AST types |
| ✅1️⃣ `ParseError(String)` (rust lib) | | 🔄 `kernel-dsl` | | human-readable message with line/col |

---

## compiler package (L2 -> L3)

| ☑️ tree-sitter | ☑️ parser-dsl | compiler | kernel-dsl | sdk | Notes |
|---|---|---|---|---|---|
| 🔄 dependency | 🔄 dependency |@dot-agent/compiler|---|---|---|
| X | X | npm only |---|---|---|

| ☑️✅🔥 compiler | kernel-dsl | ⚠️ sdk | Notes |
|---|---|---|---|
| ✅1️⃣ `core.parseAboutme(json)` → `AboutMe` | | 🔄 `sdk` | sdk imports from `compiler/core` |
| ✅1️⃣ `core.buildAboutme(opts)` → `AboutMe` | | | used internally by `pack` |
| ✅1️⃣ `core.aboutmeToJson(aboutme)` → `string` | | | used internally by `pack` |
| ✅1️⃣ `core.parseId(id)` · `core.buildId(parts)` · `core.extractDigest(id)` · `core.extractName(id)` | | | agent ID helpers |
| ✅1️⃣ `core.createZip()` · `core.extractFiles(zip, filter?)` | | 🔄 `sdk` | sdk imports from `compiler/core` |
| ✅1️⃣ `full.parse(langId, text, tree?)` → `Promise<Tree>` | | | raw tree-sitter tree; used by language-server |
| ✅1️⃣ `full.parseSync(langId, text, tree?)` → `Tree\|null` | | | sync variant for LSP diagnostics |
| ✅1️⃣ `full.nodesOfType(tree, type)` + nav helpers | | | `nodeAtOffset`, `nodeToRange`, `positionToOffset`, `getContextNode` |
| ✅1️⃣ `full.lintDescription(text, file?)` → `Promise<LintMessage[]>` | | | used by language-server and `pack` |
| ✅1️⃣ `full.lintBehavior(text, file?, docPath?)` → `Promise<LintMessage[]>` | | | used by language-server and `pack` |
| ✅1️⃣ `full.createLinter()` → `{lintDescription, lintBehavior}` | | | factory; used by language-server |
| ✅1️⃣ `full.buildTypesJson(df)` → `string` | | | JSON Schema 2020-12 from `types[]` + `input[]` + `output[]` |
| ✅1️⃣ `full.readZip(filePath)` · `full.writeZip(zip, outPath)` | | | Node.js; used by `pack` |
| ✅1️⃣ `full.validateMagicBytes(filePath)` · `full.validateZipBomb(filePath)` | | ⚠️ local copies | Node.js; sdk redefines identical fns in `load.ts` instead of importing |
| ✅1️⃣ `full.collectFiles(dir)` → `Promise<Map<string,string>>` | | | Node.js; used by `pack` |
| ✅1️⃣ `full.pack(options?)` → `Promise<PackResult>` | | | full pipeline; consumed by CLI `pack.ts` |

---

## kernel-dsl package (L2 -> L3)

| ☑️ tree-sitter | ☑️ parser-dsl | compiler | kernel-dsl | sdk | Notes |
|---|---|---|---|---|---|
| 🔄 dependency (🦀 `language_*` + `NODE_TYPES_BEHAVIOR`) | 🔄 dependency (🦀 rlib: `parse_behavior`, `parse_description`, `mod ast`) | - | <img src="https://openmoji.org/data/color/svg/E06A.svg" alt="wasm" width="24"> @dot-agent/kernel-dsl | 🔄 dependency | dual build: `pkg/` (node) + `pkg-web/` (browser) |
| 🔄 dependency | 🔄 dependency | - | 🦀 dot-agent-kernel-dsl (rlib, not published) | 🔄 dependency | links parser-dsl + tree-sitter crates directly |

| ☑️✅🔥 kernel-dsl (wasm) | sdk | Notes |
|---|---|---|
| ✅1️⃣ `init()` → `Promise<void>` (js wrapper) | | hand-written loader in `index.js`; must run before `new AgentDSLKernel()` |
| ✅1️⃣ `new AgentDSLKernel()` (wasm class ctor) | 🔄 `sdk` | constructed inside `AgentSession` |
| ✅1️⃣ `load_behavior(text)` → `string` | → `start()` | 🔄 `parser-dsl` rlib `parse_behavior`; returns effects JSON |
| ✅1️⃣ `send_intent(intent)` → `string` | → `sendIntent(intent)` | effects JSON |
| ✅1️⃣ `send_offtopic()` → `string` | → `sendOfftopic()` | |
| ✅1️⃣ `send_event(event)` → `string` | → `sendEvent(event)` | matches global `trigger_decl` |
| ✅🗓️ `tick_prompt()` → `string` | → `tickPrompt()` | advances turn counter; fires `after_stmt` |
| 🗑️ `send_complete()` · `send_failed()` (removed) | 🗑️ `sendComplete()` · `sendFailed()` (removed) | removed — `on failure` execution is v0.2; no API entry point |
| ✅1️⃣ `get_current_state()` → `string` | → `getState()` | current FSM state only |
| ✅1️⃣ `get_valid_intents()` → `js_sys::Array` | → `getValidIntents()` | intents of current state only |
| ✅1️⃣ `get_graph()` → `string` | → `getGraph()` | SCXML with runtime `_active="true"`; 🔄 `parser-dsl` `to_scxml` |
| ✅🗓️ `get_memory()` → `string` | ❌ not exposed | `{domain, key, value}[]` snapshot |
| ✅🗓️ `set_memory(domain, key, value_json)` | → `injectMemory(domain, key, value)` | |
| ✅1️⃣ `observe(callback: Function)` | ⚠️ replaced by `registerHandler` | push model; sdk uses pull-style per-effect handlers instead |
| ✅1️⃣ `free()` (wasm-bindgen auto) | → `dispose()` | WASM memory cleanup |

---

## sdk package (L3)

| tree-sitter | parser-dsl | ⚠️☑️✅🔥 compiler | ☑️✅🔥 kernel-dsl | sdk | Notes |
|---|---|---|---|---|---|
| - | - | 🔄 dependency (`compiler/core`) | 🔄 dependency (wasm) | @dot-agent/sdk | browser-compatible dispatch layer; tsup → esm + cjs |

| ☑️✅🔥 sdk export | source | Notes |
|---|---|---|
| ✅1️⃣ `loadAgent(input: Uint8Array \| ArrayBuffer)` → `Promise<AgentBundle>` | `load.ts` | 🔄 `compiler/core` `parseAboutme` + `extractFiles` |
| ✅1️⃣ `AgentSession` (class) | `session.ts` | private ctor; wraps `AgentDSLKernel` |
| ✅1️⃣ `AgentSession.start()` | | 🔄 `kernel.load_behavior` |
| ✅1️⃣ `AgentSession.registerHandler(type, handler)` | | pull-style replacement for kernel `observe` |
| ✅1️⃣ `sendIntent` · `sendEvent` · `sendOfftopic` · `tickPrompt` | | thin wrappers → `dispatchRaw(kernel.*)` |
| ✅1️⃣ `getState()` · `getValidIntents()` · `getGraph()` | | 🔄 `kernel.get_current_state` / `get_valid_intents` / `get_graph` |
| ✅🗓️ `injectMemory(domain, key, value)` | | 🔄 `kernel.set_memory` |
| ✅1️⃣ `dispose()` | | 🔄 `kernel.free` |
| ✅1️⃣ types: `AgentBundle`, `AgentFiles`, `Effect`, `EffectHandler`, `AboutMe` | `types.js` | re-exported from `index.ts` |
| ⚠️ `validateMagicBytes` · `validateZipBomb` | `load.ts` (local) | duplicated — compiler exports identical fns in `zip.ts`, not imported |
| ❌ read memory (`get_memory`) | | kernel exposes it; sdk does not surface it |

---

## Description DSL

| ☑️✅🧊 DSL| ☑️ Tree-sitter node | ☑️✅parser-dsl | ⚠️☑️✅🔥 compiler | kernel-dsl | sdk |
|---|---|---|---|---|---|
| ✅1️⃣ `agent` | ✅ `agent_name` | ✅ `AgentDecl.name` | ✅ lint + `aboutme.name` + agent `id` | | |
| ➕ | | | ✅ `aboutme.schemaVersion` — 📌 hardcoded `'dot-agent/1.0'` | | |
| ➕ | | | ✅ `aboutme.id` — `buildId({namespace=domain, name, version, digest=commit})` | | |
| ➕ | | | ⚠️ `aboutme.purpose` — 📌 hardcoded `'unknown'`; never wired to any DSL field | | |
| ➕ | | | ✅ `aboutme.compiler` — 📌 hardcoded `'dot-agent/1.0.0'` | | |
| ➕ | | | ✅ `aboutme.version` — from `PackOptions.version` / git (`resolveVersion`), not DSL | | |
| ➕ | | | ✅ `aboutme.commit` — from `PackOptions.commit` / git (`resolveCommit`), not DSL | | |
| ➕ | | | ✅ `aboutme.integrity { sha256: string, types?: string, files?: string }` — `sha256` = hex of concatenated file contents; `types`/`files` = 📌 fixed paths `.agent/types.json` · `.agent/files.json` | | |
| ✅1️⃣ `domain` | ✅ `agent_meta[domain]` | ✅ `AgentDecl.domain` | ✅ lint W003/W007 · `aboutme.domain` · `id` prefix | | |
| ✅1️⃣ `license` | ✅ `agent_meta[license]` | ✅ `AgentDecl.license` | ✅ `aboutme.license` | | |
| ✅1️⃣ `terms` | ✅ `agent_meta[terms]` | ✅ `AgentDecl.terms` | ⚠️ parsed, not written to `aboutme.json` | | |
| ✅1️⃣ `privacy` | ✅ `agent_meta[privacy]` | ✅ `AgentDecl.privacy` | ⚠️ parsed, not written to `aboutme.json` | | |
| ✅1️⃣ `description` | ✅ `description_block` | ✅ `DescriptionFile.description` | ✅ `aboutme.description` | | |
| ✅1️⃣ `persona` | ✅ `persona_block` | ✅ `DescriptionFile.persona` | ✅ `aboutme.persona` — 📌 falls back to `'SOUL.md'` when block absent | | |
| ✅1️⃣ `behavior` | ✅ `behavior_block` | ✅ `DescriptionFile.behavior` | ⚠️ parsed but unused — compiler reads the file directly | | |
| ✅2️⃣ `require` | ✅ `requires_block[]` | ✅ `DescriptionFile.requires[]` | ✅ `aboutme.requires[]` | | |
| ✅2️⃣ `input` | ✅ `input_block[]` | ✅ `DescriptionFile.input[]` | ✅ `types.json input` | | |
| ✅ `capabilities` | ✅ `capabilities_block[]` | ✅ `DescriptionFile.capabilities[]` (`AnnotatedRef {name, description}`) | ✅ `aboutme.capabilities[]` (`Capability {id, description}` — field `name`→`id`) | | |
| ✅2️⃣ `output` | ✅ `output_block[]` | ✅ `DescriptionFile.output[]` | ✅ `types.json output` | | |
| ✅ `type` (inline) | ✅ `type_decl[]` | ✅ `DescriptionFile.types[]` | ✅ `buildTypesJson(df)` | | |

> 📌 **Hardcoded values in `compiler/pack.ts` that should derive from the language — needs fixing**
>
> | Field | Hardcoded as | Should be |
> |---|---|---|
> | `files.json` `behavior` | `'agent.behavior'` | the `behavior` block value (`DescriptionFile.behavior` is parsed but ignored — compiler reads the file directly) |
> | `files.json` `description` | `'agent.description'` | the actual `.description` source filename |
> | `aboutme.purpose` | `'unknown'` | a real DSL field — none exists yet (no `purpose` in grammar) |
> | `aboutme.persona` | falls back to `'SOUL.md'` | required from the `persona` block, no silent default |
> | `aboutme.schemaVersion` | `'dot-agent/1.0'` | sourced constant, not a literal |
> | `aboutme.compiler` | `'dot-agent/1.0.0'` | the compiler package version |
> | `aboutme.integrity.types` / `.files` | `'.agent/types.json'` · `'.agent/files.json'` | fixed bundle paths — acceptable, but centralize the constants |

---

## TypeDefinition DSL (in v0.2)

| ☑️✅🧊 DSL | ☑️ Tree-sitter node | ☑️ parser-dsl | ☑️✅🔥 compiler | kernel-dsl | sdk |
|---|---|---|---|---|---|
| ✅ `type` | ✅ `type_decl` | ✅ `TypeDefinition` | ✅ `types.json $defs` | | |
| ✅ `category` | ✅ `category_prop` | ✅ `TypeDefinition.category` (OntologyRef) | ✅ `x-category` · `x-category-label` in JSON Schema | | |
| ✅ `concept` | ✅ `concept_prop` | ✅ `TypeDefinition.concept` (OntologyRef) | ✅ `x-concept` · `x-concept-label` in JSON Schema | | |
| ✅ `prop: Type` | ✅ `property_decl` | ✅ `PropertyDecl` | ✅ schema `properties` entry | | |
| ✅ `prop: Type "doc"` | ✅ `property_decl.description` | ✅ `PropertyDecl.description?` | ✅ `description` in schema property | | |
| ✅ `?` | ✅ `optional_marker` | ✅ `PropertyDecl.is_optional` | ✅ omitted from `required[]` in schema | | |
| ✅ `string \| number \| …` | ✅ `type_value` → primitive | ✅ `PropertyType::Primitive` | ✅ `{ "type": "..." }` | | |
| ✅ `TypeName` | ✅ `type_value` → reference | ✅ `PropertyType::Reference` | ✅ `{ "$ref": "..." }` (std. or local `#/$defs/`) | | |
| ✅ `[TypeName]` | ✅ `type_value` → array | ✅ `PropertyType::Array` | ✅ `{ "type": "array", "items": ... }` | | |
| ✅ `Enum(a, b)` | ✅ `type_value` → enum | ✅ `PropertyType::Enum` | ✅ `{ "type": "string", "enum": [...] }` | | |

---

## Behavior DSL

| ☑️✅🧊 DSL | ☑️ Tree-sitter node | ☑️ parser-dsl | ☑️✅🔥 compiler | ⚠️ kernel-dsl | ⚠️ sdk |
|---|---|---|---|---|---|
| ✅1️⃣ `merge` | ✅ `merge_decl` | ✅ `BehaviorFile.merges[]` | ✅ resolves for transition lint | ⚠️ field parsed, merge files not resolved at runtime | ⚠️ `files.behaviors[]` loaded but not passed to kernel |
| ✅1️⃣ `state` | ✅ `state_decl` | ✅ `StateDef` | ✅ lint + FSM validation | ✅ FSM state map | ✅ transparent via kernel |
| ✅1️⃣ `goal` | ✅ `goal_stmt` | ✅ `Statement::Goal` | ✅ lint W002 (>280 chars) | ✅ → `Effect::Goal {text}` | ✅ `registerHandler("goal", fn)` |
| ✅1️⃣ `guide` | ✅ `guide_stmt` | ✅ `Statement::Guide` | ✅ lint W010 (>280 chars) | ✅ → `Effect::Guide {text}` | ✅ `registerHandler("guide", fn)` |
| ✅1️⃣ `teach` | ✅ `teach_stmt` | ✅ `Statement::Teach` | | ✅ → `Effect::Teach {text}` | ✅ `registerHandler("teach", fn)` |
| ✅1️⃣ `interact` | ✅ `interact_stmt` | ✅ `Statement::Interact` | ✅ lint W006 (no handlers) · W013 (no goal) · W012 (goal w/o interact) · E009 (no intent handlers) | ✅ → `Effect::RequestInteract` | ✅ `registerHandler("request_interact", fn)` |
| ✅1️⃣ `on intent "…"` | ✅ `intent_handler` | ✅ `Statement::OnIntent` | ✅ lint E005/W005 (dangling transition) | ✅ `send_intent()` dispatches body | ✅ → `sendIntent(intent)` |
| ✅1️⃣ `on offtopic` | ✅ `offtopic_handler` | ✅ `Statement::OnOfftopic` | ✅ lint (missing offtopic) | ✅ `send_offtopic()` dispatches body | ✅ → `sendOfftopic()` |
| ✅1️⃣ `transition to` | ✅ `transition_stmt` | ✅ `Statement::Transition` | ✅ lint E005/W005 | ✅ → `Effect::Transition {from, to}` | ✅ `registerHandler("transition", fn)` |
| ✅ `after N prompts` | ✅ `after_stmt` | ✅ `Statement::After` | ✅ lint E011 (`after 0` never fires) | ✅ `tick_prompt()` fires at N turns | ✅ → `tickPrompt()` |
| ✅ `run script` | ✅ `run_stmt[script]` | ✅ `RunStmt { kind: Script }` | | ✅ → `Effect::RunScript {target, parameters, silent}` | ✅ `registerHandler("run_script", fn)` |
| ✅ `run subagent` | ✅ `run_stmt[subagent]` | ✅ `RunStmt { kind: Subagent }` | | ✅ → `Effect::RunSubagent {target, parameters, background}` | ✅ `registerHandler("run_subagent", fn)` |
| ✅ `run tool` | ✅ `run_stmt[tool]` | ✅ `RunStmt { kind: Tool }` | | ✅ → `Effect::RunTool {target, parameters}` | ✅ `registerHandler("run_tool", fn)` |
| 🗑️ `run … each` | 🗑️ `run_stmt[each]` | 🗑️ removed | | ❌ | ❌ |
| ✅ `set` | ✅ `memory_stmt` | ✅ `Statement::Set` | | ✅ → `Effect::SetMemory` + writes `MemoryStore` | ✅ `registerHandler("set_memory", fn)` |
| ✅ `if … end` | ✅ `conditional_stmt` | ✅ `Statement::If` | | ✅ `eval_condition()` resolves at runtime | ✅ transparent (no effect emitted) |
| ✅ `apply css` | ✅ `apply_stmt` | ✅ `Statement::Apply` | | ✅ → `Effect::ApplyCss {value}` | ✅ `registerHandler("apply_css", fn)` |
| ✅ `remove css` | ✅ `remove_stmt` | ✅ `Statement::Remove` | | ✅ → `Effect::RemoveCss {value}` | ✅ `registerHandler("remove_css", fn)` |
| ✅ `on failure` (run) | ✅ `failure_stmt` (sub-node of `run_stmt`) | ✅ `RunStmt.on_failure` | | ⚠️ field parsed, ignored at runtime (v0.2) | |
| ✅ `on failure` (apply/remove) | ✅ `failure_stmt` (sub-node of `apply_stmt`/`remove_stmt`) | ✅ `Apply.on_failure` / `Remove.on_failure` | | ⚠️ field parsed, ignored at runtime (v0.2) | |
| ✅ `parallel` | ✅ `parallel_stmt` | ✅ `Statement::Parallel` | ✅ lint E010 (no `run` stmts) | ⚠️ body executed sequentially (WASM single-threaded) | ✅ `registerHandler("run_script" / "run_subagent" / "run_tool", fn)` |
| 🗑️ `parallel on success` (removed v0.1) | 🗑️ `success_stmt` (removed — no `on success`) | 🗑️ removed | | 🗑️ removed | 🗑️ removed |
| ✅ `parallel on failure` | ✅ `on_failure` field (block) of `parallel_stmt` | ✅ `Parallel.on_failure` | | ⚠️ field parsed, ignored at runtime (v0.2) | |
| 🗑️ `on complete` | 🗑️ `on_complete_stmt` | 🗑️ removed | | 🗑️ removed | 🗑️ removed |
| 🗑️ `on failed` | 🗑️ `on_failed_stmt` | 🗑️ removed | | 🗑️ removed | 🗑️ removed |
| ✅ `on event "…"` | ✅ `trigger_decl` | ✅ `TriggerDecl` | | ✅ `send_event(name)` dispatches matching triggers | ✅ → `sendEvent(name)` |

