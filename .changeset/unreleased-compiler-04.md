---
"@dot-agent/compiler": minor
---

**`W012` generalized to `guide`/`teach`, not just `goal`.** Per ADR DA00-09, an Oriented State (one with
`interact`) is the only state allowed to carry `goal`, `guide`, or `teach`; a Setup State (no `interact`)
must carry none of them. `W012` previously checked only `goal`; it now fires for any of the three found
without `interact` in the same state, and its message lists which ones are present.
