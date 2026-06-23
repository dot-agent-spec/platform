<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0016: String Constraints & Primitive Types

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-19 |
| Author | Danilo Borges |
| Related | [RFC-0005](0005-type-system.md) — type system this RFC extends |
| Related | [RFC-0017](0017-standard-library.md) — standard library using these primitives |

| tree-sitter (L0) | parser-dsl (L1) | compiler (L2) | kernel-dsl (L2) | sdk (L3) |
|---|---|---|---|---|
| ⚠️ | ⚠️ | ⚠️ | — | ⚠️ |

---

## Summary

Extend the `string` primitive with optional constraints (`template`, `format`, `regexp`) and add richer first-class primitive types (`Timestamp`, `Currency`, `URL`, `Email`, `PhoneE164`, `Date`) to eliminate the need for `string` with constraints in the most common cases.

---

## Motivation

The current `string` primitive is too broad. Fields like `email`, `phone`, and `departure date` are typed as plain `string` in practice, which means the Runtime cannot validate their format deterministically and LLMs receive no structural hint when generating adapters between agents.

Adding constraints to `string` and introducing first-class semantic primitives solves both problems: the Runtime validates deterministically, and the type name itself communicates intent without requiring annotation.

---

## String Constraints

Three mutually exclusive constraint forms can be applied to any `string` property:

### `template` — structural pattern

A readable pattern alphabet for common structural formats:

| Symbol | Matches |
|--------|---------|
| `9` | digit 0–9 |
| `A` | uppercase letter A–Z |
| `a` | lowercase letter a–z |
| `#` | alphanumeric |
| `*` | any single character |
| other | literal (e.g. `-`, `.`, `/`) |

```
flightNumber:    string(template: "AA-9999")
reservationCode: string(template: "AAAAAA")
zipCodeBR:       string(template: "99999-999")
```

The Runtime compiles `template` patterns into regular expressions internally.

### `format` — named semantic format

Named formats from a fixed catalog, validated deterministically by the Runtime:

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

```
email:      string(format: email)
phone:      string(format: e164)
departure:  string(format: iso8601)
```

### `regexp` — escape hatch

For cases not covered by `template` or `format`:

```
iataCode: string(regexp: /^[A-Z]{2}[0-9]{1,4}$/)
```

---

## New Primitive Types

First-class primitives eliminate the need for `string(format: ...)` in the most common cases. These are standalone types, not constraints:

| Primitive | Equivalent `string(format:...)` | Notes |
|-----------|----------------------------------|-------|
| `Timestamp` | `string(format: iso8601)` | UTC, timezone implicit |
| `Date` | `string(format: date)` | Date only, no time |
| `Currency` | — | ISO 4217 amount + alphabetic code (e.g. `"BRL 42.00"`) |
| `URL` | `string(format: url)` | RFC 3986 |
| `Email` | `string(format: email)` | RFC 5322 |
| `PhoneE164` | `string(format: e164)` | ITU-T E.164 |

```
type BookingConfirmation
  category https://www.wikidata.org/wiki/Q1783551
  reservationId: string(template: "###-9999-9999")
  pickupDate:    Timestamp
  dropoffDate:   Timestamp
  totalPrice:    Currency
  car:           Car
```

---

## Implementation Notes

- `template` and `format` constraints are validated by `@dot-agent/compiler` at pack time and by the Runtime at execution time.
- `regexp` validation is Runtime-only (cannot be statically guaranteed by the compiler without executing the pattern).
- New primitive types (`Timestamp`, `Currency`, etc.) require grammar additions — they are not yet in `packages/tree-sitter`.

---

## Open Questions

- Should `format` be extensible per-agent via a local declaration (e.g. `format iata_airline /^[A-Z]{2}$/`) or remain a closed catalog defined by the spec?
- Should `template` support optional segments (e.g. `"AA[-9999]"`) or remain fully required?
- Should `Currency` encode amount + code in a single string or as a structured type?

---

## Decisions Closed

- **`regexp` is an escape hatch, not a first-class feature** — `template` and `format` cover the common cases with better readability. `regexp` exists for edge cases only.
- **First-class primitives preferred over `string(format:...)`** — When a semantic primitive exists, prefer it. `string(format:...)` remains valid for cases where no primitive exists.
