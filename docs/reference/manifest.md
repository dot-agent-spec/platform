# The Manifest (.description)

The `.description` manifest defines an agent's identity, public interface, and security requirements.

## 1. Syntax Overview

The `agent` keyword defines the root node. All semantic blocks (`description`, `behavior`, `persona`, `requires`, `input`, `output`, `capabilities`) are optional fields nested directly inside the `agent` declaration.

```
agent Analyst
  domain figma.com
  license MIT

description
  Financial analyzer

behavior analyst.behavior

input Person "The requester"
capabilities CalculateAction
output FinancialReport
```

### 1.1 Reserved Keywords

| Block | Function | Syntax Form |
|---|---|---|
| **`agent`** | Identity & Metadata | Key-value lines (`domain`, `license`, `terms`, `privacy`), separated from blocks by a blank line |
| **`description`** | Semantic Indexing | Text block following the `description` keyword |
| **`behavior`** | Implementation Link | Inline: `behavior filename.behavior` |
| **`requires`** | Context dependencies | Compact (inline) or Documented (block) |
| **`input`** | Data requirements | Compact (inline) or Documented (block) |
| **`output`** | Return types | Compact (inline) or Documented (block) |
| **`capabilities`** | Sandbox permissions | Compact (inline) or Documented (block) |

## 2. Naming & Syntax Rules

| Element | Convention | Example |
|---|---|---|
| **Agent Name** | Space-separated, capitalized | `agent Mickey Mouse` |
| **Custom Type** | PascalCase | `BankStatement` |
| **Namespaces** | `ns.Type` | `std.Prompt`, `custom.Action` |
| **Type Property** | camelCase | `accountNumber` |

### 2.1 Blocks: Compact vs. Documented
All list-based blocks (`input`, `output`, `requires`, `capabilities`) support two forms:

- **Compact**: `input Patient, Doctor` (Comma-separated, no descriptions).
- **Documented**: Indented block with optional quoted descriptions.
  - `Type "description"`: For `input`, `output`, `requires`, `capabilities`.

## 3. Security & Identity

### 3.1 Capabilities Sandbox
The `capabilities` block defines the agent's sandboxed permissions. High-risk capabilities require explicit Human-in-the-Loop authorization:
- `AgentCreation`: Permission to spawn new agent packages.
- `SelfEvolution`: Permission to modify its own `.behavior` or manifest.
- `AgentUpgrade`: Permission to request environment version bumps.

### 3.2 Domain Verification
The `domain` block prevents spoofing. If an agent claims a domain, the runtime can verify the publisher's identity via `/.well-known/dot-agent.json` — a JSON file hosted by the publisher that lists its agents and collections. Discovery format is defined in RFC-0010 (VNext).

Verification policy (whether to block unverified agents, surface warnings, or allow silently) is entirely the runtime's responsibility — the spec does not prescribe enforcement behavior.
