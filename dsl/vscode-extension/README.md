# Agent & Flow DSL — VS Code Extension

Full IDE support for the **Agent DSL** (`.agent`) and **Flow DSL** (`.flow`) languages used to define autonomous agents and their behavioral state machines.

---

## Features

### Syntax Highlighting
TextMate grammars for both `.agent` and `.flow` files — keywords, strings, operators, memory domains, and identifiers each get distinct colors.

### Hover Documentation
Hover over any keyword to see inline documentation explaining its purpose and syntax.

### Code Completion
Context-aware suggestions as you type:

| Context | Suggestions |
|---|---|
| `next ` | All state names declared in the file |
| `set ` | Memory domains: `context.`, `session.`, `worksession.`, `user.` |
| `run ` | `script`, `subagent`, `tool` |
| `on ` | `event`, `intent`, `escape`, `fallback`, `complete`, `failed` |
| Line start (unindented) in `.flow` | Top-level keywords: `state`, `merge`, `on event`, … |
| Line start (indented) in `.flow` | Block keywords: `guide`, `interact`, `next`, `if`, `parallel`, … |
| Line start (unindented) in `.agent` | Manifest keywords: `agent`, `input`, `output`, `type`, … |
| Indented inside `input`/`output`/`requires`/`capabilities` | Custom types declared in the file |

### Go-to-Definition
- **`.flow`** — Ctrl/Cmd+Click on a state name to jump to its `state` declaration.
- **`.agent`** — Ctrl/Cmd+Click on a type name to jump to its `type` declaration.

### Find All References
Right-click → "Find All References" on a state or type name to list every occurrence across the file.

### Rename Symbol (F2)
- **`.flow`** — Rename a state and all `next` references update automatically.
- **`.agent`** — Rename a type and all references in `input`/`output`/`requires`/`capabilities` update automatically.

### Document Links
File references become clickable links — Ctrl/Cmd+Click to open the target file:
- **`.flow`** — `run script "file.js"`, `run flow "file.flow"`, `guide "file"`, `teach "file"`, `apply css "file"`, etc.
- **`.agent`** — `behavior file.flow`, `schema file.json`

### Linting / Diagnostics

**`.flow` files:**
- **Dangling transition** — `next` pointing to an undeclared state → error (or warning if it looks like an external reference with a dot).
- **Dead-end interact** — `interact` with no `next` or `on intent/escape` → warning ("will trap the agent").

**`.agent` files:**
- **Deprecated keywords** — flags obsolete keywords (`do`, `server`, `author`, `version`, etc.) as errors.
- **Strict lint** — validates `input`/`output`/`requires`/`capabilities` blocks in both compact mode (`Type1, Type2`) and documented mode (`Type "Description"`).
- **Undeclared types** — warns when a type used in a block is not declared in the file (could be native or external).

### Code Actions (Quick Fixes)
Lightbulb on a diagnostic:
- **"Create state 'X'"** — inserts a new state scaffold at the end of the file.
- **"Remove this line"** — removes a deprecated keyword line.
- **"Add 'on intent' handler"** — inserts an `on intent` block after a dead-end `interact`.

### Outline (Document Symbols)
The Outline panel shows:
- **`.flow`** — states (class icon) and global event observers (`on event: name`).
- **`.agent`** — agent declarations and type declarations.

### Workspace Symbols
Ctrl/Cmd+T searches states and events across all `.flow` files and agents/types across all `.agent` files in the workspace.

### Document Formatting
Format Document normalizes indentation for both languages:
- **`.flow`** — 0 / 2 / 4 spaces for top-level, state body, and nested blocks respectively.
- **`.agent`** — 0 / 2 spaces for top-level keywords and their block content.

### Folding
Explicit fold regions at `state` and `on event` boundaries in `.flow`; at top-level keyword boundaries in `.agent`.

### Status Bar
When editing a `.flow` file, the status bar shows the name of the state the cursor is currently inside.

### Flow Graph
Open the visual state diagram for any `.flow` file:
- Click the **graph icon** in the editor title bar, or
- Run **"Flow: Open Graph"** from the Command Palette.

A Mermaid `stateDiagram-v2` diagram opens in a side panel and automatically refreshes on save.

---

## Language Reference

### `.agent` — Agent Manifest

```
agent My Agent

domain https://example.com
license MIT
description
  A brief description of what this agent does.

behavior main.flow

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

### `.flow` — Behavioral Flow

```
on event "start"
  next greeting

state greeting
  guide "Welcome! How can I help you today?"
  interact
  on intent "book meeting"
    next booking
  on escape
    guide "Are you sure you want to exit?"
    interact

state booking
  run subagent "BookingAgent"
  on complete
    next confirmation
  on failed
    next greeting

state confirmation
  guide "Your meeting has been booked."
```

---

## Snippets

| Prefix | Description |
|---|---|
| `flow` | Scaffold a minimal flow file |
| `state` | State declaration with guide and intent |
| `on event` | Top-level event trigger |
| `on intent` | Inline intent trigger |
| `on intent block` | Intent trigger with block body |
| `run script` / `run subagent` / `run tool` | Run statements |
| `set` | Memory variable assignment with domain picker |
| `if` / `ifelse` | Conditional statements |
| `merge` | Include another flow file |
| `after` | Temporal trigger after N prompts |
| `parallel` | Parallel execution with handlers |
| `on escape` / `on fallback` | Special state handlers |
| `agent` | Full agent declaration scaffold |
| `type` | Custom type declaration |

---

## Installation

Install from the `.vsix` file:

```bash
code --install-extension agent-dsl-syntax-1.3.0.vsix
```

Or build from source:

```bash
npm run package
npm run install-ext
```
