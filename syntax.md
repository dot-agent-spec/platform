# Syntax Changes and Additions

Changes and additions to the `.agent` and `.flow` DSL, organized by file type.
Each entry states what changed, the new syntax, and the rationale.

---

## `.flow` Changes

---

### `transition to` — replaces `next`

**Before**
```flow
on intent "booking_done" next completed
```

**After**
```flow
on intent "booking_done" transition to completed
```

`next` reads as programmer vocabulary — linked lists, iterators. `transition to`
describes what actually happens (a state transition) and reads naturally in
English without technical baggage. `go to` was considered and discarded due to
decades of negative association in programming. Arrow syntax (`→`) was considered
and discarded due to dependency on a non-ASCII character that degrades to `->` in
practice, which carries C/C++ associations.

---

### `on intent` — data contract with `with`

**Before**
```flow
on intent "booking_done" transition to completed
```

**After**
```flow
on intent "booking_done" with BookingConfirmation
  transition to completed
```

The `with TypeName` clause declares the data contract required for the intent to
be valid. The runtime validates the collected data against the type schema
deterministically before allowing the transition. Uses `strict: true` tool calling
internally — fields missing or of wrong type block the transition and inject a
correction prompt to the LLM.

The `with` clause position (after the intent, before the destination) reads
naturally in English: *"on intent X, carrying Y, go to Z"*.

**Inline form** (no data contract needed):
```flow
on intent "goodbye" transition to completed
```

**Block form** (data contract or multiple instructions):
```flow
on intent "confirm_booking" with BookingConfirmation
  complete BookingAction
  transition to completed
```

---

### `goal` — capability entry point annotation

**Before**
```flow
state car_reservation
  goal "Collect reservation details"
```

**After**
```flow
state car_reservation
  goal BookingAction "Collect reservation details"
```

The optional `CapabilityName` before the text string marks this state as the
entry point for that capability in the flat FSM. The runtime uses this annotation
to resolve which state to enter when another agent calls
`start BookingAction in "carrent.com"`. No special state naming convention is
required. A capability has exactly one entry state per flow file.

---

### `complete` — capability exit with output contract

**New statement**
```flow
complete BookingAction with BookingConfirmation
```

Declares that the current state fulfills the named capability and delivers the
named type as output. Can appear inside an `on intent` block or as a standalone
statement before `transition to`.

**Multiple possible output types** use `or`:
```flow
complete GenerateAction with AvatarWithEars or AvatarWithMickey
```

The `or` is intentional — the capability delivers one of the listed types, not
all of them. The runtime validates whichever type was actually produced.

---

### `on escape` — local and global

**Global** (top of file, applies to all states):
```flow
on escape
  guide "User has abandoned the current task. Return to start."
  transition to responsive
```

**Local** (inside a state, overrides global for that state):
```flow
state car_reservation
  goal BookingAction "Collect reservation details"
  interact
  on escape
    guide "Booking abandoned. Return to main menu."
    transition to responsive
```

Escape is identified by the LLM, not by keyword matching. The `guide` inside the
`on escape` block instructs the LLM on what constitutes a genuine escape vs an
off-topic question that should be answered and continued. Off-topic questions
within a state do not trigger escape.

`on escape` and `on fallback` are distinct:
- `on escape` → user changes subject or explicitly abandons the current task
- `on fallback` → user message does not match any declared intent

---

### `on offtopic` — user changes subject

```flow
state order_food
  goal "Help user place a food order"
  guide "..."
  interact
  on intent "order_confirmed" transition to completed
  on offtopic transition to responsive
```

Identified by the LLM when the user voluntarily shifts to a subject outside
the current state's domain — e.g. asking about investments while placing a
food order. Not an error, not an unmatched intent — the conversation is simply
outside scope.

A bare `transition to` is sufficient. The destination state has its own `goal`
and `guide` — no additional orientation is needed in the handler itself. If
a `guide` is needed, the design signal is that the destination state is
insufficiently defined.

---

### `on fallback` — systemic failure handler

```flow
state car_reservation
  goal BookingAction "Collect reservation details"
  run tool "booking.api"
  on complete with BookingConfirmation
    complete BookingAction
    transition to completed
  on fallback
    transition to error
```

Executes on runtime-level failures — a tool is unavailable, an external agent
did not respond, a `run tool` returned an error. Not triggered by conversation
state: if the LLM has not yet matched a declared intent, the `interact` loop
simply continues. That is not a fallback — it is the conversation in progress.

In v1, `on fallback` is intentionally simple. Agents that require detailed
error handling can implement that logic in WASM. The flow DSL handles the
routing; error semantics are the agent author's responsibility.

The distinction in full:

| Keyword | Triggered by | Scenario |
|---|---|---|
| `on fallback` | Runtime | Tool unavailable, external agent unreachable, execution error |
| `on offtopic` | LLM | User voluntarily changes subject |
| *(no handler)* | — | LLM has not matched an intent yet — interact loop continues normally |

---

### `start ... in` — cross-agent capability call

**Named agent** (explicit, takes priority):
```flow
start BookingAction in "carrent.com"
on complete with BookingConfirmation
  set context.car_booking = results
  transition to confirm_trip
on fallback
  transition to error
```

**Anonymous** (runtime resolves best match):
```flow
start BookingAction
on complete with BookingConfirmation
  set context.car_booking = results
  transition to confirm_trip
on fallback
  transition to error
```

When no agent is specified, the runtime queries the registry for agents that
expose the named capability, evaluates compatibility via Wikidata category and
agent description, and suggests the best match to the user before proceeding.

When an agent is named, it is used directly without resolution — this covers
brand-specific integrations where the agent identity matters (e.g.
`start VectorizeAction in "illustrator.adobe.com"` rather than any compatible
vector tool).

If no compatible agent is found in either case, `on fallback` executes.
In v1, `on fallback` routes to a state — detailed error semantics are the
agent author's responsibility and can be implemented in WASM if needed.

---

## `.agent` Changes

---

### `category` — required field in `type`, replaces mandatory `concept`

**Before**
```agent
type BookingConfirmation
  concept https://schema.org/Reservation
  reservationId: string
  ...
```

**After**
```agent
type BookingConfirmation
  category https://www.wikidata.org/wiki/Q1783551
  concept  https://schema.org/Reservation           // now optional
  reservationId: string
  ...
```

`category` is now required on every `type` declaration. It references a Wikidata
QID and is used by the runtime for adapter compatibility checks between agents.
Wikidata QIDs are stable, multilingual, and carry a maintained semantic hierarchy
that enables subclass-based compatibility detection.

`concept` remains valid as an optional supplementary annotation (schema.org,
Wikidata, or other ontology) but is no longer used in runtime decisions.

---

### `string` — template and format constraints

The `string` primitive gains optional constraints that restrict acceptable values
without requiring the author to write regular expressions.

**`template`** — structural pattern with a readable alphabet:

| Symbol | Matches |
|--------|---------|
| `9` | digit 0–9 |
| `A` | uppercase letter A–Z |
| `a` | lowercase letter a–z |
| `#` | alphanumeric |
| `*` | any single character |
| other | literal (e.g. `-` `.` `/`) |

```agent
flightNumber:    string(template: "AA-9999")
reservationCode: string(template: "AAAAAA")
zipCodeBR:       string(template: "99999-999")
```

**`format`** — named semantic type from the catalog:

| Format | Spec |
|--------|------|
| `email` | RFC 5322 |
| `e164` | ITU-T E.164 |
| `iso8601` | date and time with timezone |
| `date` | date only, no time |
| `url` | RFC 3986 |
| `uuid` | UUID v4 |
| `currency` | ISO 4217 alphabetic code |
| `country` | ISO 3166-1 alpha-2 |
| `language` | BCP 47 |

```agent
email:      string(format: email)
phone:      string(format: e164)
departure:  string(format: iso8601)
```

**`regexp`** — escape hatch for cases not covered by template or format:

```agent
iataCode: string(regexp: /^[A-Z]{2}[0-9]{1,4}$/)
```

All three forms are validated deterministically by the runtime. The runtime
compiles `template` patterns into regular expressions internally. String
constraints are included in the context sent to the LLM when generating
adapters between agents.

---

### Primitive type additions

Richer primitives eliminate ambiguity that would otherwise require `template`
or `format` on a plain `string`. These are first-class types, not constraints:

```agent
type BookingConfirmation
  category https://www.wikidata.org/wiki/Q1783551
  reservationId: string(template: "###-9999-9999")
  pickupDate:    Timestamp     // UTC, timezone implicit
  dropoffDate:   Timestamp
  totalPrice:    Currency      // ISO 4217 amount + code
  car:           Car
```

Planned additions to the primitive catalog (not yet in grammar):
`Timestamp`, `Currency`, `URL`, `Email`, `PhoneE164`, `Date`.

---

## Grammar Impact Summary

| File | Rule | Change |
|------|------|--------|
| `flow/grammar.js` | `transition_stmt` | `next` → `transition to` |
| `flow/grammar.js` | `intent_trigger` | adds optional `with type_ref` before block/inline |
| `flow/grammar.js` | `goal_stmt` | adds optional `capability: identifier` before text |
| `flow/grammar.js` | `complete_stmt` | new rule: `complete identifier (with type_ref (or type_ref)*)` |
| `flow/grammar.js` | `start_stmt` | new rule: `start identifier in quoted_string` |
| `flow/grammar.js` | `escape_stmt` | now valid at top-level (global) and inside block (local) |
| `agent/grammar.js` | `type_property` | adds `category_prop` as required, `concept_prop` becomes optional |
| `agent/grammar.js` | `type_value` | `string` gains optional `(template:...)`, `(format:...)`, `(regexp:...)` suffix |
| `agent/grammar.js` | `format_name` | new rule: catalog of valid format identifiers |
| `agent/grammar.js` | `string_constraint` | new rule: `template` or `format` modifier |
| `agent/grammar.js` | `regexp_literal` | new rule: `/pattern/` literal |

---

## Open Questions

- Should `format` be extensible per-agent via a local declaration
  (e.g. `format iata_airline /^[A-Z]{2}$/`) or only via spec versions?

- Should `template` support optional segments (e.g. `"AA[-9999]"`)
  or remain fully required?

- Should the `or` separator in `complete ... with A or B` be validated
  at parse time (types must exist in agent output declarations) or only
  at runtime?

## Decisions Closed

- **`on escape` requires a `guide` block** — No. A bare `transition to` is
  sufficient. Each state owns its `goal` and `guide`. Orientation belongs to
  the destination state, not to the handler that routes to it.

- **`on fallback` for unmatched intents** — No. An unmatched intent means the
  interact loop continues. `on fallback` is reserved for systemic runtime
  failures only.

- **One `goal`, one `guide` per state** — Confirmed. If a different goal or
  guide is needed, it belongs in a different state. The flow DSL is a subset
  and shortcut — complexity goes in WASM.