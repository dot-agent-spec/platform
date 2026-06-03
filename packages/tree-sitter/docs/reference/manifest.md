# The Manifest (.description)

The `.description` file (or the root `grammar.js` in this repo) defines the agent's identity, requirements, and interface.

## 1. Base Structure

The `agent` keyword defines the root node. Identity metadata (`domain`, `license`, `terms`, `privacy`) is indented under it. Semantic blocks (`description`, `behavior`, `requires`, etc.) are top-level in the file — implicitly associated with the preceding `agent` declaration.

```
agent Analyst
  domain figma.com
  license MIT
  terms  https://figma.com/terms
  privacy https://figma.com/privacy

description
  A financial agent that analyzes expenses and generates reports

behavior analyst.behavior

requires BankStatement

input
  Person "The user requesting financial analysis"

capabilities
  CalculateAction "Enables mathematical calculations"
  SearchAction    "Queries external financial rates"

output
  FinancialProduct "The recommended product for the user"
```

**Semantic block keywords:**

| Keyword | Function |
|---|---|
| `description` | Free-text description. Used by the Runtime for semantic indexing. |
| `behavior` | The `.behavior` file that manages state and transitions. Always inline: `behavior agent.behavior`. |
| `requires` | Types the Runtime must guarantee in context before invoking the `.behavior`. |
| `input` | Input data types the agent needs to operate. |
| `capabilities` | Actions (Schema.org `Action`) or resources the agent may use. Also the sandboxing contract. |
| `output` | The data type returned by the agent. |

## 2. Naming Conventions and Comments

**Naming conventions:**

| Element | Convention | Examples |
|---|---|---|
| Agent name | Space-separated words, each capitalized | `agent Doctor`, `agent Mickey Mouse` |
| Custom type | Continuous PascalCase | `UserProfile`, `BankStatement`, `MedicalCondition` |
| Stdlib namespace | `std.` + PascalCase | `std.Prompt`, `std.ImageObject` |
| Custom namespace | `custom.` + PascalCase | `custom.SpeechSynthesis` |
| Type property | camelCase | `patient`, `createdAt`, `transactionList` |

The parser distinguishes agent names from types by structural context: after `agent`, it always expects an `agent_name` (space-separated words); after `input`, `output`, etc., it always expects type references (PascalCase).

**Comments:** any line (or fragment) starting with `//` is ignored by the parser. Comments may appear inline or on their own lines, including inside blocks.

```
// This agent is in draft
agent Draft
  domain example.com
```

## 3. Compact vs. Documented Syntax

The `requires`, `input`, `capabilities`, and `output` blocks support two forms:

**Compact** (inline, no descriptions):
```
input Patient, MedicalCondition
capabilities DiagnoseAction, CreateAction
requires Prontuario, UserProfile
```

**Documented** (indented block, optional descriptions):
```
input
  Patient "The patient to attend"
  MedicalCondition

capabilities
  DiagnoseAction         "Emits clinical diagnoses"
  custom.SpeechSynthesis "Voice synthesis"

requires
  Prontuario ("Electronic health record")
  UserProfile
```

The difference between annotation and description:
- **Parenthesized annotation** `Type ("text")` — in `type_reference`, documents what that type means in this specific context
- **Quoted description** `Type "text"` — in `typed_item`/`cap_item` (input/output/capabilities blocks), documents the purpose of the item

## 4. Security and Capabilities

The `capabilities` block is not merely descriptive — it is a **sandboxing contract**. The Runtime uses this list to determine which permissions the agent holds.

If an agent declares `SelfEvolution` or `AgentCreation`, the Runtime intercepts these requests and may require explicit human authorization (Human-in-the-Loop) before modifying packages in `.agents/*`.

**High-risk capabilities:**

| Capability | Effect |
|---|---|
| `AgentCreation` | Can create sub-agents |
| `SelfEvolution` | Can modify its own behavior files |
| `AgentUpgrade` | Can request runtime version updates |

## 5. Identity and Anti-Spoofing (the `domain` block)

Declaring `domain figma.com` turns the local manifest into a pointer to the official authority:

1. **W3C validation:** The Runtime verifies identity using W3C DIDs or `.well-known` directories
2. **Synchronization:** The Runtime may fetch the canonical definition from `https://figma.com/.well-known/agents/Figma.agent` and override the local manifest
3. **Spoof prevention:** If an attacker creates an agent with `domain figma.com`, the Runtime fetches from the real server. If the server doesn't list that agent, the local package is invalidated.

Informal community agents may omit `domain` — the Runtime treats them as "Unverified".
