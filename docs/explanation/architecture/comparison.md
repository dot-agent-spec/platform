# Architecture & Execution Comparison: JS/TS vs. dot-agent DSL

This document provides a comparative analysis of the compilation and runtime execution architectures of JavaScript/TypeScript vs. the **dot-agent** DSL ecosystem.

---

## 1. TypeScript Architecture (Compilation-Only Reference)

In TypeScript, all compiler logic, parsing, type checking, and emitter functionality resides in a single core package (`typescript`). Both the CLI tool (`tsc`) and the IDE Language Service (`tsserver`) consume this shared package, ensuring 100% identical diagnostics.

```mermaid
graph TD
    subgraph TS_Core ["TypeScript Core Library (typescript.js)"]
        Parser["Parser / Scanner<br/>(Generates AST)"]
        Binder["Binder<br/>(Creates scopes and symbols)"]
        Checker["Type Checker<br/>(Inference & semantic validation)"]
        Emitter["Emitter<br/>(Generates final JS and .d.ts files)"]
        
        Parser --> Binder
        Binder --> Checker
        Checker --> Emitter
    end

    subgraph TS_Consumers ["Entrypoints / Consumers"]
        TSC["tsc (CLI)<br/>Compiles files via terminal"]
        TSServer["tsserver (Language Service)<br/>API for autocompletion & refactoring"]
    end

    subgraph IDEs ["Editors / Clients"]
        VSCode["VS Code / VS Code TS Extension"]
        Neovim["Neovim / LSP (via tsserver integration)"]
    end

    %% Dependency flows
    TS_Core --> TSC
    TS_Core --> TSServer
    
    TSServer <-->|"TS Server Protocol (JSON)"| VSCode
    TSServer <-->|"TS Server Protocol (JSON)"| Neovim
```

---

## 2. JavaScript Execution Runtime Architecture (Node.js & Browsers)

Because TypeScript is compilation-only (it does not execute code), we must look at how the JavaScript runtime (e.g., V8) manages execution. 

A JS engine compiles and executes source code, interacting with a **Host Environment** (Node.js or Browser) that provides external APIs (DOM, filesystem) via an event loop, and exposes a debugging protocol (Chrome DevTools Protocol) to IDEs.

```mermaid
graph TD
    subgraph Engine ["JS Engine (e.g., V8)"]
        Parser["Parser<br/>(Source -> AST)"]
        Interpreter["Interpreter (Ignition)<br/>(AST -> Bytecode)"]
        JIT["JIT Compiler (TurboFan)<br/>(Bytecode -> Machine Code)"]
        VM_State["VM Memory / Call Stack<br/>(Execution Context)"]
        
        Parser --> Interpreter
        Interpreter --> JIT
        Interpreter -.-> VM_State
        JIT -.-> VM_State
    end

    subgraph Host ["Host Environment (Browser / Node.js)"]
        EventLoop["Event Loop<br/>(libuv / Browser Loop)"]
        HostAPIs["Host APIs / WebAPIs<br/>(DOM, fetch / fs, http, child_process)"]
    end

    subgraph Inspector_Protocol ["DevTools Protocol"]
        Inspector["V8 Inspector / CDP<br/>(JSON-RPC / WebSockets)"]
    end

    IDE["VS Code Debugger / Chrome DevTools"] <--> Inspector_Protocol
    Inspector_Protocol <--> VM_State
    VM_State <--> EventLoop
    EventLoop <--> HostAPIs
```

---

## 3. dot-agent DSL Architecture (Current State)

Currently, compiler validation and linter checks are fragmented across different packages. The Language Server and the CLI maintain separate linting implementations. Additionally, the VS Code client contains custom regex-based parsing to draw graphs.

```mermaid
graph TD
    subgraph LS_Module ["dsl/language-server/"]
        LSP_Diag["diagnostics.js (JS AST Walker)<br/>Editor-specific diagnostics"]
    end

    subgraph CLI_Module ["dot-agent-cli/"]
        CLI_Lint["lint.ts (JS Walker + Rust Kernel)<br/>CLI linter validation before packaging"]
    end

    subgraph Rust_Kernel ["dsl/kernel-dsl/"]
        Kernel["Rust FSM Engine (WASM)<br/>Validates state semantics and runs FSM"]
    end

    subgraph Editor_Clients ["Editors & Clients"]
        VSCode_Client["vscode-dot-agent<br/>Parses text with regex for Mermaid visualizer"]
    end

    %% Connections
    Rust_Kernel -.->|Loaded optionally| CLI_Lint
    LS_Module <-->|LSP| VSCode_Client
```

---

## 4. dot-agent DSL Proposed Runtime Architecture

To match the clean separation of JS/TS architectures, the dot-agent ecosystem splits execution into:
1. **The Host SDK (`@dot-agent/sdk`)**: Functions as the host environment and orchestrator. It uses the compiler to Just-In-Time (JIT) parse the `.behavior` text into an execution graph, injects it into the kernel, and resolves the effects emitted by the kernel (invoking LLMs, running scripts, calling MCP tools). It also supports **Pluggable Kernels** if a package ships with a custom `.wasm`.
2. **The VM/Kernel (`@dot-agent/kernel-dsl`)**: Functions as the engine. It is a "blind" execution environment that receives the pre-parsed FSM structure. It tracks memory scopes (`context`, `session`, etc.), manages the active FSM state, and yields deterministic side-effects (**Effects**).
3. **The LSP Debugger Protocol**: Allows IDE tools to inspect memory state and FSM graphs without reinventing the parser.

```mermaid
graph TD
    subgraph Host_Environment ["Host SDK (Node.js / Electron / LLM OS)"]
        DSL_Compiler["Compiler (JIT Loader)<br/>(Tree-sitter: Source -> AST/Graph)"]
        Effect_Handler["Effect Handler / Event Loop<br/>(Resolves effects dynamically)"]
        Host_APIs["SDK APIs / Tools / LLMs<br/>(LLM Prompts, MCP Tools, Scripts)"]
        
        Effect_Handler <--> Host_APIs
    end

    subgraph Runtime_Engine ["dot-agent Kernel (@dot-agent/kernel-dsl or Custom WASM)"]
        FSM_Interpreter["FSM Interpreter<br/>(Executes Graph -> Yields Effects)"]
        FSM_State["FSM State & Memory Domains<br/>(context, session, user, worksession)"]
        
        FSM_Interpreter <--> FSM_State
    end

    DSL_Compiler -->|Injects In-Memory Graph| FSM_Interpreter
    FSM_Interpreter -->|Yields Effects| Effect_Handler

    subgraph Debug_Protocol ["Debug / LSP Protocol"]
        LSP_Protocol["LSP / Custom JSON-RPC Debugger<br/>(State updates & FSM graph)"]
    end

    IDE_Debugger["VS Code Graph Visualizer / Status Bar"] <--> Debug_Protocol
    Debug_Protocol <--> FSM_State
```

---

## 5. Summary of Analogies

| JavaScript Ecosystem Component | dot-agent DSL Ecosystem Component | Purpose |
|:---|:---|:---|
| **V8 Engine (Ignition/TurboFan)** | `@dot-agent/kernel-dsl` (Rust FSM Engine) | The core virtual machine. Executes the pre-parsed FSM logic, manages execution memory, and evaluates logic state. Can be swapped with custom `.wasm` kernels. |
| **Node.js/Browser Host APIs** (DOM, `fs`, `fetch`) | **Host SDK / LLM OS** (Orchestrator) | The surrounding execution environment. Performs the JIT compile, does actual I/O, runs LLM turns, calls MCP tools, and runs script tasks. |
| **JS Event Loop** (libuv) | **Effect Handler / Loop** | Listens for completion of async operations (e.g. script finished, LLM response ready) and feeds the event back into the FSM engine. |
| **Chrome DevTools Protocol (CDP)** | **LSP / Custom Debug JSON-RPC** | Protocol enabling IDE extensions to inspect FSM states, look up memory, and pull graph structural metadata. |
| **TypeScript Compiler (`tsc`)** | `dot-agent pack` (CLI validation core) | Builds, type-checks, and bundles resources (`agent.description` + `agent.behavior` + custom files) into a final `.agent` ZIP package. |
| **TypeScript Language Server (`tsserver`)**| `@dot-agent/language-server` | IDE bridge providing lint errors, completions, definition navigation, and live debugging info. |
