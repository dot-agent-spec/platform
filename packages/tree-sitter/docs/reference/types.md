# Type System and Namespaces

## 1. Custom Types

Whenever an agent uses data that doesn't exist in Schema.org, the type must be declared with `type`. The declaration is a **hard contract** for the Runtime — the LLM never attempts to infer the structure of a custom type.

```
type BankStatement
  concept https://www.wikidata.org/wiki/Q806653 ("Bank account statement")
  account: Person      "Account holder"
  transactions: [Transaction]
  balance: Number
  status: Enum(active, closed, suspended)
  avatar?: ImageObject "Holder photo (optional)"
```

**Keywords inside `type`:**

| Keyword | Function |
|---|---|
| `concept` | Wikidata or Schema.org URL anchoring semantic meaning globally. |
| `schema` | (Optional) Strict JSON Schema file for validation: `schema bankstatement.json` |

**Property value forms:**

| Form | Example | Semantics |
|---|---|---|
| Simple reference | `account: Person` | Single type |
| Array | `transactions: [Transaction]` | Typed list |
| Enum | `status: Enum(active, closed)` | Closed set of literals |
| Optional | `avatar?: ImageObject` | `?` marks the field as optional |
| With description | `account: Person "Holder"` | Quoted string documents the property |

## 2. Namespace Resolution

Types without a namespace are resolved by the Runtime in the following precedence order:

1. **Custom** — `type` declarations in the agent's own package (absolute precedence)
2. **Standard Library** — `std.*` (pre-defined types in the Spec)
3. **Global** — Schema.org / Wikidata

The local scope has **absolute shadowing**: if a `type Prompt` exists locally, it takes priority over `std.Prompt` automatically, preventing third-party updates from breaking the agent.

*Example:* The type `Prompt` is referenced. If a local `type Prompt` exists → uses local. Otherwise, the Runtime resolves `std.Prompt`.
