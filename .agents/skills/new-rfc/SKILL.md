---
description: Scaffold a new RFC from the project template
disable-model-invocation: true
arguments: [topic]
effort: low
---

# /new-rfc — Create a New RFC

Scaffolds `rfcs/<NNNN>-<slug>.md` from `templates/rfc.md` and updates `rfcs/INDEX.md`.

**Usage:** `/new-rfc <topic>` — e.g. `/new-rfc streaming output format`

If no topic is provided as an argument, ask the user before starting.

---

## Step 1 — Collect inputs

You need two values before proceeding:

1. **Topic** — a short phrase describing what the RFC proposes.
   - If the user provided a topic as a `/new-rfc` argument, use it directly.
   - Otherwise ask: *"What should this RFC propose? Give a short phrase."*

2. **Author name** — name to put in the RFC's `Author` field.
   - Default: `Danilo Borges`. Use the default unless the user specifies otherwise.

Do not proceed until both values are known.

---

## Step 2 — Determine the next RFC number

Run this exact command from the repository root:

```bash
find rfcs -maxdepth 2 -name "[0-9][0-9][0-9][0-9]-*.md" | grep -oE '[0-9]{4}' | sort -n | tail -1
```

This covers active RFCs (`rfcs/`) and archived ones (`rfcs/implemented/`, `rfcs/rejected/`), preventing number collisions when an RFC is moved.

- If the command returns a number N, the new RFC number is `N + 1`, zero-padded to 4 digits (e.g. `0019`).
- If the command returns nothing or fails, start at `0001`.

---

## Step 3 — Derive title and slug

From the topic:

- **Title** — convert to Title Case, trim filler words if needed (e.g. "streaming output format" → "Streaming Output Format")
- **Slug** — lowercase, hyphen-separated (e.g. `streaming-output-format`)
- **Filename** — `rfcs/<NNNN>-<slug>.md`

---

## Step 4 — Read the template

Read `templates/rfc.md`.

**Do not reproduce the template structure from memory.** Use the file content as the single source of truth for section order, formatting, and wording.

---

## Step 5 — Build the RFC file

Starting from the exact content of `templates/rfc.md`, apply these edits in order:

**a) License comment** — Keep the Apache 2.0 `<!-- Copyright … -->` block at the top unchanged.

**b) Template instructions block** — Delete the second `<!-- RFC TEMPLATE … -->` block entirely (the one that begins with "RFC TEMPLATE — copy to rfcs/…").

**c) Inline guidance comments** — Delete all remaining HTML comments inside the document body (e.g. `<!-- One paragraph… -->`, `<!-- Package impact table… -->`, `<!-- The design… -->`).

**d) Heading** — Replace `# RFC-NNNN: Title` with `# RFC-<number>: <Title>`.

**e) Metadata table** — Make these changes:

| Field | Action |
|---|---|
| `Status` | Set to `Draft` |
| `Created` | Run `date +%Y-%m-%d` and use the output — **do not guess the date** |
| `Author` | Set to the author name from Step 1 |
| `Depends on` row | Delete unless there is a confirmed dependency |
| `Related` row | Delete unless there is a known related RFC |

---

## Step 6 — Fill the package impact table

> **Effort seam.** The rest of this skill runs at `effort: low` (declared in the frontmatter). This step is the only part that requires judgment. Delegate it at higher effort:
> ```
> Agent({ effort: "high", prompt: "Given this RFC topic: <topic>\n\nAssign one symbol per package: <paste symbol legend and package table from below>. Return a JSON object with keys: tree_sitter, parser_dsl, compiler, kernel_dsl, sdk." })
> ```
> Use the Agent result to fill the table. If the session model is already high-quality, you may skip the Agent call and fill the table directly.

For each of the five core packages, assign one symbol:

| Symbol | Meaning |
|---|---|
| `—` | Not related — this package needs no changes |
| `⚠️` | Impacted — this package needs code changes |
| `🔄` | Consumes — reads another package's output without itself changing |
| `?` | Ambiguous — impact depends on an unresolved design decision |

**Package responsibilities (quick reference):**

| Package | Layer | What it owns |
|---|---|---|
| `tree-sitter` | L0 | WASM grammar — syntax rules only |
| `parser-dsl` | L1 | Rust/WASM parser → `BehaviorFile` / `DescriptionFile` AST |
| `compiler` | L2 | Linting, semantic validation, `.agent` ZIP packaging |
| `kernel-dsl` | L2 | Micro-kernel FSM execution, emits `Effect[]` |
| `sdk` | L3 | Browser dispatch layer, loads `.agent` bundles |

**Rules:**
- New syntax → `tree-sitter` is `⚠️`, `parser-dsl` is `⚠️`
- New AST semantics → `compiler` and/or `kernel-dsl` is `⚠️`
- Reading another package's output without producing new output → `🔄`
- Purely host/server-side concerns (`.well-known`, deploy config) → all `—`
- If unsure → use `?` and add an **Open Questions** entry (see Step 7)

Fill the table rows in the RFC. If the RFC also touches packages outside the core five (e.g. `transpiler-core`, `dot-agent-cli`), add immediately after the table:

```
> **Also impacts:** package-name
```

---

## Step 7 — Scaffold section bodies

Keep all section headers from the template unchanged. Under each section:

- **Summary** — Write one paragraph that paraphrases the RFC topic in plain terms. Do not invent technical details; keep it at the level of "what this RFC proposes."
- **All other sections** — Leave empty (no placeholder text, no comments). The author fills them in.
- **Open Questions** — If any `?` cell was placed in the impact table (Step 6), add one bullet per ambiguous cell explaining what must be resolved. Otherwise leave empty.

---

## Step 8 — Write the file

Write the complete RFC to `rfcs/<NNNN>-<slug>.md`.

---

## Step 9 — Update `rfcs/INDEX.md`

Add a row to the `## Active (Draft)` table. Insert it at the **bottom** of the table (just above the closing `---`):

```markdown
| [RFC-<NNNN>: <Title>](<NNNN>-<slug>.md) | Draft | <L0> | <L1> | <compiler> | <kernel> | <sdk> | <summary> |
```

Where:
- `<L0>` … `<sdk>` are the symbols from Step 6 in column order: `tree-sitter`, `parser-dsl`, `compiler`, `kernel-dsl`, `sdk`
- `<summary>` is a one-line description of the RFC's core intent (≤ 120 characters, matches the Summary section)

---

## Checklist — verify before reporting done

- [ ] File exists at the correct path: `rfcs/<NNNN>-<slug>.md`
- [ ] File starts with the Apache 2.0 license comment block
- [ ] Heading is exactly `# RFC-<NNNN>: <Title>`
- [ ] Metadata table has `Status: Draft`, correct `Created` date, correct `Author`
- [ ] `Depends on` and `Related` rows removed (unless populated)
- [ ] Package impact table has no empty cells — every cell is `—`, `⚠️`, `🔄`, or `?`
- [ ] Any `?` cell has a corresponding entry in **Open Questions**
- [ ] All 8 section headers present: Summary, Motivation, Specification, Rationale, Implementation Notes, Open Questions, Decisions Closed, Related
- [ ] No HTML guidance comments remain in the body
- [ ] `rfcs/INDEX.md` has a new row in the `## Active (Draft)` table

All boxes must be checked before the task is complete.
