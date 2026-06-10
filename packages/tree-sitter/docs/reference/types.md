# Type System & Namespaces

The .agent DSL uses explicit type contracts to ensure deterministic data flow between agents.

## 1. Custom Type Declaration

Custom types are defined using the `type` keyword. These act as hard contracts—the Runtime never infers structure.

```
type BankStatement
  category https://www.wikidata.org/wiki/Q806653 (Bank statement)
  concept https://schema.org/BankAccount
  account: Person      "Account holder"
  transactions: [Transaction]
  status: Enum(active, closed)
  avatar?: ImageObject
```

### 1.1 Keywords & Properties

| Keyword | Required | Function |
|---|---|---|
| **`category`** | Yes | Primary semantic URI (Wikidata/Schema.org) + optional parenthesized label. |
| **`concept`** | No | Secondary URI that refines the category with a more specific concept. |

### 1.2 Property Forms

| Form | Syntax | Description |
|---|---|---|
| **Simple** | `name: Type` | Single value reference. |
| **Array** | `name: [Type]` | Ordered list of types. |
| **Enum** | `name: Enum(a, b)` | Fixed set of literal values. |
| **Optional** | `name?: Type` | Marks the property as optional via `?`. |
| **Doc** | `name: Type "desc"` | Quoted string for property documentation. |

## 2. Namespace Resolution

Types are resolved using **absolute shadowing** in the following precedence:

1. **Local**: `type` declarations within the agent's own package.
2. **Standard Library**: Built-in types prefixed with `std.*`.
3. **Global**: Implicitly resolved via Schema.org or Wikidata if no local/std match exists.

> **Note**: A local `type Prompt` will always shadow `std.Prompt`, ensuring that third-party updates to the standard library do not break existing agent logic.
