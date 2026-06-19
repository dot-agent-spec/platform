<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# RFC-0014: Data Contract

| Field | Value |
|---|---|
| Status | Draft |
| Created | 2026-06-19 |
| Author | Danilo Borges |
| Related | [RFC-0015](0015-cross-agent.md) — cross-agent calls use data contracts for output types |

---

## Summary

Introduce data contract syntax to the `.behavior` language: `on intent ... with TypeName` for intent validation, `goal CapabilityName "text"` for marking capability entry points, and `complete CapabilityName with Type` for declaring capability fulfillment with an explicit output type.

---

## Motivation

Currently, `.behavior` handlers route by intent string but carry no information about the data structure accompanying that intent. The Runtime cannot validate collected data deterministically before allowing a transition. Similarly, there is no way to annotate which state serves as the entry point for a declared capability, or what type a capability delivers as output.

These three features form a cohesive unit: capabilities have entry points (`goal`), exit points (`complete`), and the data flowing through intent transitions is validated (`with`).

---

## `on intent ... with TypeName`

The `with TypeName` clause declares the data contract required for an intent transition to be valid. The Runtime validates collected data against the type schema before allowing the transition.

**Inline form** (no data contract):
```
on intent "goodbye" transition to completed
```

**Block form with data contract:**
```
on intent "confirm_booking" with BookingConfirmation
  complete BookingAction
  transition to completed
```

**Behavior when validation fails:** the Runtime injects a correction prompt to the LLM — fields missing or of wrong type block the transition and ask the LLM to collect the missing data. Uses `strict: true` tool calling internally.

The `with` clause position reads naturally in English: *"on intent X, carrying Y, go to Z"*.

---

## `goal CapabilityName "text"`

The optional `CapabilityName` before the goal text marks this state as the entry point for that named capability in the flat FSM.

**Before:**
```
state car_reservation
  goal "Collect reservation details"
```

**After:**
```
state car_reservation
  goal BookingAction "Collect reservation details"
```

The Runtime uses this annotation to resolve which state to enter when another agent calls `start BookingAction in "carrent.com"` (see [RFC-0015](0015-cross-agent.md)). No special state naming convention is required. A capability has exactly one entry state per `.behavior` file.

---

## `complete CapabilityName with Type`

Declares that the current state fulfills the named capability and delivers the named type as output. Can appear inside an `on intent` block or as a standalone statement before `transition to`.

```
complete BookingAction with BookingConfirmation
```

**Multiple possible output types** use `or`:
```
complete GenerateAction with AvatarWithEars or AvatarWithMickey
```

The `or` means the capability delivers one of the listed types, not all of them. The Runtime validates whichever type was actually produced.

**Full example:**
```
state car_reservation
  goal BookingAction "Collect reservation details"
  interact
  on intent "confirmed" with BookingConfirmation
    complete BookingAction with BookingConfirmation
    transition to completed
  on offtopic transition to responsive
```

---

## Implementation Notes

- `with TypeName` in `on intent` requires grammar additions to `packages/tree-sitter/tree-sitter-behavior/grammar.js`.
- `goal CapabilityName "text"` requires the `goal_stmt` rule to accept an optional identifier before the string.
- `complete` is a new statement type — not currently in the grammar.
- The compiler must validate that a `CapabilityName` used in `goal` matches a `capabilities` declaration in the corresponding `.description` file.

---

## Open Questions

- Should `complete` be allowed outside an `on intent` block (as a standalone statement in a setup state)?
- Should the `or` in `complete ... with A or B` be validated at parse time (types must exist in agent output declarations) or only at runtime?

---

## Decisions Closed

- **`with` position is after intent, before destination** — reads naturally as *"on intent X, carrying Y"*. Alternatives (`on intent "X" [transition to Y] with Z`) were less readable.
- **One entry point per capability per file** — a capability has exactly one `goal` annotation. Multiple entry points would make routing ambiguous.
