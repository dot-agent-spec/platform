# The Manifest (.description)

The `.description` manifest defines an agent's identity, public interface, and security requirements.

## 1. Syntax Overview

The `agent` keyword defines the root node. Semantic blocks are top-level and implicitly belong to the preceding `agent`.

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
| **`agent`** | Identity & Metadata | Indented key-value (`domain`, `license`, `terms`, `privacy`) |
| **`description`** | Semantic Indexing | Indented text block |
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
  - `Type "description"`: For `input`, `output`, `capabilities`.
  - `Type ("annotation")`: For `requires` (documents usage in this specific context).

## 3. Security & Identity

### 3.1 Capabilities Sandbox
The `capabilities` block defines the agent's sandboxed permissions. High-risk capabilities require explicit Human-in-the-Loop authorization:
- `AgentCreation`: Permission to spawn new agent packages.
- `SelfEvolution`: Permission to modify its own `.behavior` or manifest.
- `AgentUpgrade`: Permission to request environment version bumps.

### 3.2 Domain Verification
The `domain` block prevents spoofing. The Runtime verifies identity using W3C DIDs or `.well-known` discovery. If an agent claims a domain, its canonical manifest must be verifiable at `https://<domain>/.well-known/agents/<Name>.agent`.
