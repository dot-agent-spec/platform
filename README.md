# dot-agent

Specification and implementation repository for the dot-agent ecosystem — a language and runtime for building deterministic, composable AI agents.

---

## What is dot-agent?

Every agent is defined by two files:

```
agent.description  —  the manifest: identity, capabilities, data contracts
agent.behavior     —  the behavior: state machine, LLM orchestration, tool calls
```

The **Runtime** reads the manifest for sandboxing and discovery; it executes the behavior for orchestration. Agents are deterministic, composable, and portable across runtimes.

---

## Documentation

| Section | Contents |
|---|---|
| [`dsl/`](dsl/) | Language reference — syntax, semantics, and design of `.description` and `.behavior` |
| [`docs/`](docs/) | Implementation reference — compiler APIs, kernel protocol, SDK, architecture |
| [`rfcs/`](rfcs/) | Design proposals for new language and protocol features |
| [`examples/`](examples/) | Canonical annotated agent examples |

**Architecture overview:** [`docs/explanation/architecture/map.md`](docs/explanation/architecture/map.md)

---

## Packages

| Package | Description |
|---|---|
| `@dot-agent/tree-sitter` | WASM grammar — canonical grammar source |
| `@dot-agent/parser-dsl` | Rust/WASM parser for `.behavior` and `.description` |
| `@dot-agent/kernel-dsl` | Rust/WASM FSM execution engine |
| `@dot-agent/compiler` | Linter, semantic validation, ZIP packaging |
| `@dot-agent/sdk` | Browser-compatible dispatch layer |
| `@dot-agent/language-server` | LSP server for IDE support |

---

## License

Apache 2.0 — see [LICENSE](LICENSE).
