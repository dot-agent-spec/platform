# Templates

Canonical shapes for the project's design documents. Copy a template, fill it in, delete the
guidance comments. The goal is that any newcomer can produce a document indistinguishable from
the existing ones.

| Template | Use for | Lands in | Lifecycle |
|---|---|---|---|
| [`rfc.md`](rfc.md) | "Should we do X, and how?" — a design proposal requiring ratification | [`rfcs/`](../rfcs/) | Draft → Review → Accepted → Implemented (then frozen) |
| [`adr.md`](adr.md) | "We decided X because Y" — a single hard-to-reverse decision | [`adr/`](../adr/) | Proposed → Accepted → (Superseded) — immutable once Accepted |
| [`plan.md`](plan.md) | "How do we build X?" — multi-phase work with a living record | [`plans/`](../plans/) | Backlog → In Progress → Shipped (the file is never deleted) |
| [`task.md`](task.md) | "We decided to do X — here's what to change" | [`tasks/`](../tasks/) | Planned → In Progress → Done (then removed) |
| [`release-freeze-task.md`](release-freeze-task.md) | Pre-release checklist + automated release steps for a package | [`tasks/`](../tasks/) | Planned → Done (then removed by release script) |

**RFC vs ADR vs Plan vs Task:** an RFC argues a direction; an ADR records a settled decision (often
distilled out of an RFC's *Decisions Closed* section so it becomes findable); a plan is the design record
for how a multi-phase build works, kept alive while the work happens; a task is a single concrete work
order that is deleted once done. Choosing between the last two: if the work will land in phases at
different times and you will still be reading the document after the first one ships, it is a plan.

Full lifecycles, the DA numbering scheme and which skill closes which are in
[`.agents/rules/governance.md`](../../.agents/rules/governance.md), which loads automatically inside
`project/`.

## Not here yet (org-wide candidates)

Community-health and product templates apply to every repo, not just the spec. The professional home
for the GitHub-rendered ones (`CONTRIBUTING`, `CODE_OF_CONDUCT`, `SECURITY`, issue/PR templates) is a
single **org-level `.github` repository** — files placed there become the default for every repo in the
organization. Product/UX templates (vision, PRD, job stories) belong with the product.
