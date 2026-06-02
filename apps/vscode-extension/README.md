# .agent DSL — VS Code Extension

Full IDE support for the **.agent DSL** (`.description`, `.type`, `.behavior`) used to define autonomous agents and their behavioral state machines.

---

## Architecture

This extension is a thin LSP client. Most IDE features (hover, completions, diagnostics, go-to-definition, references, rename, symbols, formatting) are provided by the **[.agent DSL Language Server](https://github.com/dot-agent-spec/language-server)** — a standalone Node.js process started automatically when the extension activates. The server is bundled with the extension and speaks the Language Server Protocol over stdio.

Two features are implemented directly in the extension (VS Code-specific):
- **Behavior Graph** — Mermaid state diagram rendered in a WebView panel
- **Status bar** — shows the current `state` the cursor is inside

---

## Features

### Syntax Highlighting
TextMate grammars for `.description`, `.type`, and `.behavior` files — keywords, strings, operators, memory domains, and identifiers each get distinct colors.

### Hover Documentation
Hover over any keyword to see inline documentation explaining its purpose and syntax.

### Code Completion
Context-aware suggestions as you type:

| Context | Suggestions |
|---|---|
| `transition to ` | All state names declared in the file |
| `set ` | Memory domains: `context.`, `session.`, `worksession.`, `user.` |
| `run ` | `script`, `subagent`, `tool` |
| `on ` | `event`, `intent`, `offtopic`, `fallback`, `complete`, `failed` |
| Line start (unindented) in `.behavior` | Top-level keywords: `state`, `merge`, `on event`, … |
| Line start (indented) in `.behavior` | Block keywords: `guide`, `interact`, `transition`, `if`, `parallel`, … |
| Line start (unindented) in `.description` | Manifest keywords: `agent`, `input`, `output`, `type`, … |
| Indented inside `input`/`output`/`requires`/`capabilities` | Custom types declared in the file |

### Go-to-Definition
- **`.behavior`** — Ctrl/Cmd+Click on a state name to jump to its `state` declaration.
- **`.description`** — Ctrl/Cmd+Click on a type name to jump to its `type` declaration.

### Find All References
Right-click → "Find All References" on a state or type name to list every occurrence across the file.

### Rename Symbol (F2)
- **`.behavior`** — Rename a state and all `transition` references update automatically.
- **`.description`** — Rename a type and all references in `input`/`output`/`requires`/`capabilities` update automatically.

### Document Links
File references become clickable links — Ctrl/Cmd+Click to open the target file:
- **`.behavior`** — `run script "file.js"`, `run behavior "file.behavior"`, `guide "file"`, `teach "file"`, `apply css "file"`, etc.
- **`.description`** — `behavior file.behavior`, `schema file.json`

### Linting / Diagnostics

**`.behavior` files:**
- **Dangling transition** — `transition to` pointing to an undeclared state → error (or warning if it looks like an external reference with a dot).
- **Dead-end interact** — `interact` with no `transition` or `on intent/offtopic` → warning ("will trap the agent").

**`.description` files:**
- **Strict lint** — validates `input`/`output`/`requires`/`capabilities` blocks in both compact mode (`Type1, Type2`) and documented mode (`Type "Description"`).
- **Undeclared types** — warns when a type used in a block is not declared in the file (could be native or external).

### Code Actions (Quick Fixes)
Lightbulb on a diagnostic:
- **"Create state 'X'"** — inserts a new state scaffold at the end of the file.
- **"Add 'on intent' handler"** — inserts an `on intent` block after a dead-end `interact`.

### Outline (Document Symbols)
The Outline panel shows:
- **`.behavior`** — states (class icon) and global event observers (`on event: name`).
- **`.description`** — agent declarations and type declarations.

### Workspace Symbols
Ctrl/Cmd+T searches states and events across all `.behavior` files and agents/types across all `.description` files in the workspace.

### Document Formatting
Format Document normalizes indentation for both languages:
- **`.behavior`** — 0 / 2 / 4 spaces for top-level, state body, and nested blocks respectively.
- **`.description`** — 0 / 2 spaces for top-level keywords and their block content.

### Folding
Explicit fold regions at `state` and `on event` boundaries in `.behavior`; at top-level keyword boundaries in `.description`.

### Status Bar
When editing a `.behavior` file, the status bar shows the name of the state the cursor is currently inside.

### Behavior Graph
Open the visual state diagram for any `.behavior` file:
- Click the **graph icon** in the editor title bar, or
- Run **"Behavior: Open Graph"** from the Command Palette.

A Mermaid `stateDiagram-v2` diagram opens in a side panel and automatically refreshes on save.

---

## Language Reference

### `.description` — Agent Manifest

```
agent My Agent

domain https://example.com
license MIT
description
  A brief description of what this agent does.

behavior main.behavior

input
  UserMessage "The user's message"

output
  Response

capabilities
  SendEmail
  ReadCalendar

type UserMessage
  concept https://schema.org/Message
  schema schemas/user-message.json
```

### `.behavior` — Behavioral Flow

```
on event "start"
  transition to greeting

state greeting
  guide "Welcome! How can I help you today?"
  interact
  on intent "book meeting"
    transition to booking
  on offtopic
    guide "Are you sure you want to exit?"
    interact

state booking
  run subagent "BookingAgent"
  on complete
    transition to confirmation
  on failed
    transition to greeting

state confirmation
  guide "Your meeting has been booked."
```

---

## Snippets

| Prefix | Description |
|---|---|
| `behavior` | Scaffold a minimal behavior file |
| `state` | State declaration with guide and intent |
| `on event` | Top-level event trigger |
| `on intent` | Inline intent trigger |
| `on intent block` | Intent trigger with block body |
| `run script` / `run subagent` / `run tool` | Run statements |
| `set` | Memory variable assignment with domain picker |
| `if` / `ifelse` | Conditional statements |
| `merge` | Include another behavior file |
| `after` | Temporal trigger after N prompts |
| `parallel` | Parallel execution with handlers |
| `on offtopic` / `on fallback` | Special state handlers |
| `agent` | Full agent declaration scaffold |
| `type` | Custom type declaration |

---

## Installation

Install from the `.vsix` file:

```bash
code --install-extension vscode-dot-agent-0.2.0.vsix
```

Or build from source:

```bash
npm run package
npm run install-ext
```

---

## License

Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges) — Project: https://github.com/dot-agent-spec

Licensed under the **Apache License, Version 2.0** — see [`LICENSE`](LICENSE).
