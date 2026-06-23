---
description: Scaffold a new ADR from the project template
disable-model-invocation: true
arguments: [topic]
effort: inherit
---

# /new-adr — Create a New Architecture Decision Record

Scaffolds `adr/<NNNN>-<slug>.md` from `templates/adr.md`.

**Usage:** `/new-adr <decision topic>` — e.g. `/new-adr REST-first API surface`

If no topic is provided as an argument, ask the user before starting.

---

## Step 1 — Collect inputs

You need two values before proceeding:

1. **Decision** — a short noun phrase naming the settled choice (e.g. "REST-first API surface", "Two-axis versioning"). This becomes the ADR title.
   - If the user provided a topic as a `/new-adr` argument, use it directly.
   - Otherwise ask: *"What decision should this ADR record? Give a short noun phrase."*

2. **Supersession** — whether this ADR supersedes an existing one.
   - Ask: *"Does this ADR supersede an existing ADR? If yes, which number (e.g. 0003)?"*
   - Record the superseded number, or note that there is none.

Do not proceed until both values are known.

---

## Step 2 — Determine the next ADR number

Run this exact command from the repository root:

```bash
find adr -maxdepth 1 -name "[0-9][0-9][0-9][0-9]-*.md" | grep -oE '[0-9]{4}' | sort -n | tail -1
```

- If the command returns a number N, the new ADR number is `N + 1`, zero-padded to 4 digits (e.g. `0003`).
- If the command returns nothing or fails, start at `0001`.

---

## Step 3 — Get today's date

Run:

```bash
date +%Y-%m-%d
```

Use this output as the ADR's `Date` field. Never guess the date.

---

## Step 4 — Derive slug and filename

From the decision noun phrase:

- **Slug** — lowercase, hyphen-separated (e.g. "REST-first API surface" → `rest-first-api-surface`)
- **Filename** — `adr/<NNNN>-<slug>.md`

---

## Step 5 — Read the template

Read `templates/adr.md`.

**Do not reproduce the template structure from memory.** Use the file content as the single source of truth for section order, formatting, and the license block.

---

## Step 6 — Determine status

The default status is **`Accepted`**. This is the common confusion point: most ADRs record a decision that was *already made* — use `Accepted`. Only use `Proposed` if the user explicitly says the record is being circulated for ratification *before* the decision is finalized.

If unclear, ask: *"Is this decision already settled (Accepted) or still being circulated before ratification (Proposed)?"* Default to `Accepted` if the user does not object.

---

## Step 7 — Build the ADR file

Starting from the exact content of `templates/adr.md`, apply these edits in order:

**a) License comment** — Keep the Apache 2.0 `<!-- Copyright … -->` block unchanged at the top.

**b) Template instructions block** — Delete the `<!-- ADR TEMPLATE … -->` block entirely (the comment block starting with "ADR TEMPLATE — based on Michael Nygard's format").

**c) Inline guidance comments** — Delete all remaining HTML comments in the body (e.g. `<!-- The forces at play… -->`, `<!-- The choice, in active voice… -->`, `<!-- Status lifecycle… -->`).

**d) Heading** — Replace `# ADR-NNNN: Title (the decision, stated as a short noun phrase)` with `# ADR-<NNNN>: <Decision noun phrase>`.

**e) Metadata table** — Make these changes:

| Field | Action |
|---|---|
| `Status` | Set to `Accepted` (or `Proposed` — see Step 6) |
| `Date` | Set to today's date from Step 3 |
| `Deciders` | Set to `Danilo Borges` |
| `Supersedes` | Set to `ADR-MMMM` if superseding; otherwise remove this entire row |
| `Superseded by` | Remove this entire row (it will be filled in later if this ADR is ever superseded) |

**f) Context section** — Write 2–4 sentences describing the forces at play: the problem, constraints, and what makes this decision necessary now. Audience is a newcomer with no prior context. State facts, not the conclusion.

**g) Decision section** — One sentence in active voice starting with "We will …". Be specific. One decision per ADR.

**h) Options considered section** — This is the judgment-intensive part.

> **Effort seam.** All other steps run at `effort: inherit`. This section requires deliberate judgment: enumerate the realistic alternatives (including rejected ones) with honest trade-offs. If the session model is small or the decision is non-trivial, delegate this step at higher effort:
> ```
> Agent({ effort: "high", prompt: "Decision: <decision>\nContext: <context paragraph>\n\nList 3–4 options that were plausible for this decision, including the one chosen. For each: a short label, a one-line pro/con trade-off, and whether it was chosen or rejected (and why if rejected). Format as a markdown bulleted list matching: **Option X — label** — trade-off." })
> ```
> Use the Agent result to fill the section. If the session model is already strong, fill directly.

Format each option as: `- **Option A — …** — pro / con.` Mark the chosen option with `(chosen)`. Include at least one rejected option with a brief reason.

**i) Consequences section** — What becomes easier AND what becomes harder as a result. Be honest about accepted costs. Note any follow-up work, new constraints, or risks introduced. If there are critical follow-ups, call them out explicitly.

**j) Sunset & reversal section** — Add this section **only if** the decision is expected to expire or become obsolete (e.g. a stopgap measure). Follow the structure in `adr/0002-model-tiering-for-agent-routing.md` exactly: include *When to revisit* and *How to unwind* sub-bullets. Omit this section entirely otherwise — do not add it as an empty placeholder.

**k) Related section** — List the RFCs that produced this decision, tasks it unblocks, or sibling ADRs. If nothing is related, leave the section empty (do not add placeholder text).

---

## Step 8 — Write the file

Write the complete ADR to `adr/<NNNN>-<slug>.md`.

---

## Step 9 — Handle supersession (if applicable)

If this ADR supersedes ADR-MMMM:

1. Locate `adr/MMMM-*.md` by scanning the `adr/` directory for the file whose name starts with `MMMM-`.
2. In that file, update **only these two cells in the metadata table**:
   - `Status` → `Superseded`
   - `Superseded by` → `ADR-<NNNN>` (this ADR's number)
3. **Do not touch any other content.** The body — Context, Decision, Options considered, Consequences, Related — stays exactly as-is. Immutability of accepted ADRs is sacred; violating it corrupts the project's decision history.

---

## Checklist — verify before reporting done

- [ ] File exists at the correct path: `adr/<NNNN>-<slug>.md`
- [ ] File starts with the Apache 2.0 license comment block
- [ ] Heading is exactly `# ADR-<NNNN>: <Decision noun phrase>`
- [ ] Metadata table has correct `Status`, `Date` (from `date` command), `Deciders`
- [ ] `Supersedes` row present and set to `ADR-MMMM` if superseding; row absent otherwise
- [ ] `Superseded by` row removed
- [ ] All guidance HTML comments removed from body
- [ ] All five sections present: Context, Decision, Options considered, Consequences, Related
- [ ] `Sunset & reversal` section present only if the decision is expected to expire; absent otherwise
- [ ] Options considered: at least one rejected option with reason; chosen option marked `(chosen)`
- [ ] If superseding: old ADR's `Status` updated to `Superseded` and `Superseded by` set to this ADR; body unchanged
- [ ] No placeholder or template text remains in the body

All boxes must be checked before the task is complete.
