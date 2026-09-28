# dot-agent-spec — Trust Boundaries

## Scope

`dot-agent-spec` is the specification and implementation of a language for describing agent
behaviour (`.description` + `.behavior`), the toolchain that compiles and lints it
(`@dot-agent/parser-dsl`, `@dot-agent/compiler`), the runtime that executes it
(`@dot-agent/kernel-dsl`, `@dot-agent/sdk`), and two long-lived front ends that host the
toolchain for a human or an editor (`@dot-agent/language-server` / `vscode-dot-agent`, and
`dot-agent-cli`'s MCP servers). `tools/wasi-stub` is a vendored build tool used to build the
WASM targets and is not itself a shipped component, so it is not treated as an input boundary
below. See the full component map at
[`docs/explanation/architecture/map.md`](map.md).

## Untrusted inputs

| Format | Who writes it | First reader |
|---|---|---|
| `.agent` bundle (ZIP) | Anyone who produces or shares an agent package | `@dot-agent/sdk` `loadAgent()` — `packages/sdk/src/load.ts:7` |
| `.behavior` source text | The agent's author (may be a third party relative to whoever runs it) | `@dot-agent/parser-dsl` `parse_behavior()` — `packages/parser-dsl/src/parser.rs:206` |
| `.description` source text | The agent's author | `@dot-agent/parser-dsl` `parse_description()` — `packages/parser-dsl/src/description_parser.rs:56` |
| Editor document text (`.description`/`.behavior`/`.agent` files open in the workspace) | Whoever wrote the workspace files, via the editor | `@dot-agent/language-server` `parse()` — `packages/language-server/server.js:14` (delegates to `packages/language-server/parser.js`) |
| Serialized FSM state (`fsm_state_json`) | Whatever process last called `serialize_state()` — trusted only if that process is trusted | `@dot-agent/kernel-dsl` `restore_state()` / `restore_state_json()` — `packages/kernel-dsl/src/lib.rs:225`, `packages/kernel-dsl/src/engine/mod.rs:294` |
| MCP tool call arguments (`load_agent`, `send_intent`, …) | The MCP client / calling agent | `apps/dot-agent-cli/src/commands/mcp-run.ts` and `apps/dot-agent-cli/src/commands/server-mcp.ts` (tool handlers) |

## Paths

### `.agent` bundle → running session (SDK path)

1. `@dot-agent/sdk` `loadAgent(bytes)` — `packages/sdk/src/load.ts:7` — validates magic bytes and
   zip-bomb ratio (`validateMagicBytes`, `validateZipBomb`, `packages/compiler/src/zip-core.ts:8,14`),
   then reads `.agent/aboutme.json` and `.agent/files.json` from the zip.
2. `@dot-agent/compiler/core` `parseAboutme`, `extractFiles`, `classifyContentPath` —
   `packages/sdk/src/load.ts:4` — extracts and classifies every file the manifest names
   (guides, knowledge, behaviors).
3. `@dot-agent/kernel-dsl` `load_behavior` / `load_behavior_with_bundle` —
   `packages/kernel-dsl/src/lib.rs:66,122` — parses the bundle's `.behavior` text into FSM state.
4. `@dot-agent/sdk` `AgentSession` — `packages/sdk/src/session.ts` — dispatches the kernel's
   `Effect[]` to caller-registered handlers (guess: the exact dispatch call site was not opened;
   marked as a guess).

### `.behavior` / `.description` text → diagnostics (editor path)

1. `@dot-agent/language-server` `TextDocuments` `onDidOpen`/`onDidChangeContent` —
   `packages/language-server/server.js` — receives the document text over LSP.
2. `parse()` in `packages/language-server/parser.js` (via `initParsers`, imported at
   `packages/language-server/server.js:14`) — tree-sitter parse for syntax.
3. `@dot-agent/compiler` `consolidate()` — `packages/language-server/server.js:10` — combines
   syntax and semantic diagnostics via `@dot-agent/parser-dsl` `parse_behavior_with_diagnostics`
   (`packages/parser-dsl/src/parser.rs:129`).
4. `diagnose()` — `packages/language-server/features/diagnostics.js` — returns diagnostics to the
   editor. (Guess: file not opened; named from the import list at `server.js:20`.)

### MCP tool call → running agent session (CLI path)

1. `apps/dot-agent-cli/src/commands/mcp-run.ts` — `McpServer` tool handlers (`load_agent`,
   `send_intent`, …) receive client-supplied arguments, validated with `zod` schemas
   (`packages/... mcp-run.ts:7`).
2. `@dot-agent/sdk` `loadAgent()` / `AgentSession` — same as the SDK path above — bytes come from
   `readFile`/`stat` on a path the MCP client names (`apps/dot-agent-cli/src/commands/mcp-run.ts:4`).
3. The `Runtime` box (`session`, `bundle`) is held across every subsequent tool call in the same
   process — `apps/dot-agent-cli/src/commands/mcp-run.ts:23-28`.

## Long-lived processes

- **`@dot-agent/language-server`** (`packages/language-server/server.js`) — an LSP server process
  (`createConnection`, `packages/language-server/server.js` import list). It keeps parsed-document
  state (`TextDocuments`) and a workspace root cache (`setWorkspaceRoots`) across every document the
  editor opens or edits in the session.
- **`apps/dot-agent-cli` MCP servers** (`server-mcp.ts`, `mcp-run.ts`) — an MCP server process
  (`McpServer`, `StdioServerTransport`/`StreamableHTTPServerTransport`). It keeps the loaded
  `AgentSession` and `AgentBundle` in a mutable `Runtime` box (`mcp-run.ts:23-28`) across every
  `send_intent`/`send_event` call until a new `load_agent` replaces it.
- **`vscode-dot-agent`** (`apps/vscode-extension/extension.js`) — an editor extension host process
  (`vscode.ExtensionContext` activation, `contributes.languages` in
  `apps/vscode-extension/package.json`). It keeps a `LanguageClient` connection open for the life of
  the editor window.
- `apps/dot-agent-cli/src/index.ts` and `src/cli.ts` also matched the inventory's `longlived`
  pattern (they import the MCP-server-starting commands) but are themselves short-lived command
  dispatchers, not servers; the state lives in the imported command modules above, not in these
  files. (Judgment call.)

## Builds

| Build | Consumers | Limit the others lack |
|---|---|---|
| `@dot-agent/parser-dsl` WASM (`packages/parser-dsl/pkg/dot_agent_parser_dsl_bg.wasm`) | `@dot-agent/compiler`, `@dot-agent/language-server`, browser/Node via `@dot-agent/sdk` | A WASM trap ends the call without aborting the host process; the consumer decides whether to re-initialise the module afterwards. The WASM stack is smaller than the native one. |
| `@dot-agent/kernel-dsl` WASM (`packages/kernel-dsl/pkg/dot_agent_kernel_dsl_bg.wasm`) | `@dot-agent/sdk` (`load_behavior` and `load_behavior_with_bundle`, `kernel-dsl/src/lib.rs:66,122`, the second taking the bundle's files as JSON) | Same as the parser WASM: a trap ends the call without aborting the host, and the consumer decides whether to re-initialise the module. |
| `@dot-agent/tree-sitter` generated parser (`packages/tree-sitter/tree-sitter-behavior/src/parser.c`, `tree-sitter-description/src/parser.c`) | `@dot-agent/parser-dsl` (Rust, via FFI `extern "C"` — `packages/tree-sitter/bindings/rust/src/lib.rs:6`) | Native C code: a malformed grammar input that trips undefined behaviour here can abort the whole process, not just the WASM instance. |
| JavaScript build of `@dot-agent/compiler`, `@dot-agent/sdk`, `@dot-agent/language-server`, `dot-agent-cli` (Node, `dist/index.cjs`) | Node/CLI/editor hosts | A thrown JS error is catchable per call; it does not poison a WASM instance or abort the process the way the native/WASM builds can. |

## Trusted

- The bundled tree-sitter grammar and generated parser C code (`packages/tree-sitter/`) are treated
  as maintainer-controlled build output, not as untrusted input, even though they parse untrusted
  text.
- `tools/wasi-stub`, per the maintainer's decision, is a vendored build-time tool, not a shipped
  component — its output is trusted the way any other build tool's output is.
- `.agent/aboutme.json` and `.agent/files.json` are trusted for their shape once the zip has passed
  `validateMagicBytes` and `validateZipBomb`, and parsed with `parseAboutme`. Where their content (paths,
  ids) is validated is listed under Limits.

## Limits at each hop

| Hop | Bound |
|---|---|
| `.agent` bundle, uncompressed size (`packages/compiler/src/zip-core.ts:19`) | bounds size at `MAX_ZIP_SIZE` = 500 MiB |
| `.agent` bundle, compression ratio (`packages/compiler/src/zip-core.ts:22`) | bounds ratio at `MAX_COMPRESSION_RATIO` = 100x |
| `.agent` bundle, magic bytes (`packages/compiler/src/zip-core.ts:8`) | rejects anything not starting `PK\x03\x04`; no bound on the rest of the byte stream's structure beyond that |
| `.behavior` / `.description` text into `parse_behavior` / `parse_description` (`packages/parser-dsl/src/parser.rs:206`, `packages/parser-dsl/src/description_parser.rs:56`) | not assessed |
| `.agent/files.json` paths into the extractor (`packages/sdk/src/load.ts`, `packages/compiler/src/pack.ts`) | not assessed |
| FSM state into `restore_state_json` (`packages/kernel-dsl/src/engine/mod.rs:294`) | rejects malformed JSON (comment at lines 291-293); size and depth not assessed |
| Editor document text into the language server's parser (`packages/language-server/parser.js`) | not assessed |
| MCP tool arguments into `mcp-run.ts` handlers | shape bounded by the `zod` schemas; size not assessed |
