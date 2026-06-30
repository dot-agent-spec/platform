<!--
 Copyright (c) 2026 Danilo Borges (https://github.com/daniloborges)

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 https://www.apache.org/licenses/LICENSE-2.0
-->

# How Programming Languages Evolve — A Study Reference

A neutral survey of how established languages and standards bodies manage change: proposing features,
shipping them experimentally, stabilizing them, and evolving without breaking existing code. It is
written as study material — a guide to prior art — not as a prescription.

---

## The common shape

Across very different communities, one structure recurs. Every mature process distinguishes three
states that ad-hoc processes tend to conflate:

1. **Proposed** — someone wants it; the design is under discussion.
2. **Available but unstable** — usable in practice, but explicitly subject to change.
3. **Stable** — a contract; it will not break.

The names differ (stages, channels, provisional, editions), but the separation is the invariant. The
sections below are variations on this theme, each with one distinctive mechanism worth understanding.

---

## TC39 — ECMAScript (JavaScript)

**Process:** a staged pipeline, Stage 0 through Stage 4.

- **Stage 0 (Strawperson):** an informal idea.
- **Stage 1 (Proposal):** a *champion* owns it; the problem, a rough API, and examples exist; the
  committee agrees it is worth exploring.
- **Stage 2 (Draft):** formal specification text. An intermediate **Stage 2.7** (introduced 2024) marks
  that the spec is reviewed and conformance tests are written.
- **Stage 3 (Candidate):** the spec is complete; implementers (browsers) build it and give feedback.
- **Stage 4 (Finished):** two independent implementations pass the conformance suite (test262); the
  proposal merges into the standard.

**Distinctive idea:** the yearly edition (ES2015, ES2020, …) is a **snapshot** of whatever reached
Stage 4 that year — not a plan. Features are never promised into a specific version, and a proposal can
be dropped at any stage without stigma.

**Lesson:** version numbers describe what is done, not what is intended.

---

## Rust

**Process:** an RFC repository (PR-based), with a **Final Comment Period (FCP)** in which the relevant
team announces an intent to accept or reject, opens a last window for objections, and records the
disposition.

Three mechanisms stand out:

1. **Feature gates / release channels.** Unstable features exist only on the *nightly* channel, behind
   an explicit opt-in (`#![feature(...)]`). This ships experimental work to real users while keeping
   stabilization a separate, later decision. The train model — nightly → beta → stable on a fixed
   cadence — guarantees stable never breaks.

2. **Editions (2015, 2018, 2021, 2024).** An edition may introduce breaking changes (even new
   keywords), but it is **opt-in per crate**, and crates of different editions **interoperate** in one
   build. The compiler understands all editions simultaneously.

3. **Stability attributes** (`#[stable]`, `#[unstable]`, `#[deprecated]`) make a feature's state
   machine-checkable in the source itself.

**Lesson:** editions are the state-of-the-art answer to "how do we change syntax without splitting the
ecosystem" — freezing is not the end of evolution.

---

## Go

**Process:** a proposal process (issues + a proposal-review committee), with experimental features
guarded by a `GOEXPERIMENT` build flag.

**Distinctive idea:** the **Go 1 Compatibility Promise** — code written for Go 1.0 keeps compiling
across the entire Go 1.x line. Famously, generics were debated for roughly a decade and only shipped in
Go 1.18 (2022), rather than shipping a design the team would regret.

**Lesson:** shipping the wrong syntax permanently is worse than shipping it late. Patience is a feature
of the process, not a failure of it.

---

## Python

**Process:** PEPs (Python Enhancement Proposals), governed by a Steering Council, with categories for
standards-track, informational, and process changes.

Two mechanisms stand out:

1. **`from __future__ import …`** — code can opt into future behavior *before* it becomes the default
   (e.g. `print_function`, `division`, `annotations`), enabling gradual migration without a hard break.

2. **Provisional APIs (PEP 411)** — a module can be marked *provisional*: shipped and usable, but
   explicitly exempt from the normal backward-compatibility guarantee. `asyncio`, `typing`, and
   `pathlib` all began this way.

A formal **deprecation policy** (warnings for several releases before removal) ensures nothing vanishes
without notice.

**Lesson:** "provisional / preview" is an official vocabulary for "usable but not yet committed" — a
mark of rigor, not of incompleteness.

---

## Swift

**Process:** the Swift Evolution repository. Proposals (`SE-NNNN`) begin as a *pitch* on the forums,
move to a formal *review* window, and end in a core-team decision (accepted / rejected / returned for
revision). Large directions are framed by **vision documents** before individual proposals.

**Distinctive idea:** **language modes** (e.g. Swift 6 mode) play the same role as Rust editions —
opting a module into newer, stricter, possibly source-breaking behavior while older code keeps building.

**Lesson:** a vision document gives a north star that keeps independent proposals coherent.

---

## C++

**Process:** the ISO committee, organized into study groups (SG), advancing papers (`PNNNN`).

**Distinctive idea:** **Technical Specifications (TS)** act as proving grounds — Concepts, Coroutines,
Modules, and Networking all lived as separate TS documents, gathering implementation experience, before
being merged into the standard. **Feature-test macros** (`__cpp_*`) let code query whether a feature is
available.

**Lesson:** a formal "experimental track" separate from the standard lets ambitious features mature
before they become permanent commitments.

---

## The contrast: WHATWG (HTML / DOM)

**Process:** a **Living Standard** — no versions at all; the specification is updated continuously.

This works because browsers auto-update, so there is no distributed artifact that must keep working
against an old version of the spec. It is the opposite extreme from Go's compatibility promise, and a
useful reminder that *having versions is a choice driven by how the artifact is distributed* — not a law.

---

## Synthesis — recurring principles

- **Separate proposed, unstable, and stable.** Three explicit states, always.
- **Versions are snapshots, not promises.** Commit the current milestone precisely; status the rest.
- **Make "preview / provisional" a first-class label.** It buys the right to change.
- **The hard problem is evolving syntax without breaking old artifacts.** Editions / language modes are
  the leading answer; they require each artifact to record the version it was authored against.
- **A written proposal with a named champion and a dated decision** is what turns an opinion into a
  process — independent of team size.
- **Patience is professionalism.** Permanent mistakes cost more than delay.
- **Record decisions where they can be found.** Buried decisions get relitigated.

---

## Relevance to dot-agent

The project's own process maps onto this prior art: the RFC lifecycle mirrors staged proposal processes;
the `0.x` grammar-as-preview posture mirrors provisional APIs and nightly feature gates; the planned
post-1.0 **editions** strategy mirrors Rust/Swift; and provenance-stamping each `.agent` with its DSL
version is the prerequisite that makes that editions strategy possible. See [`GOVERNANCE.md`](../../../GOVERNANCE.md)
and [`ROADMAP.md`](../../../ROADMAP.md).
