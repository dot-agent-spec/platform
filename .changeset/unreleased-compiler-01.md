---
"@dot-agent/compiler": minor
---

**`W018` — unreachable entry statement after a state-level `transition to`.** A state's entry
statements stop running as soon as it leaves for another state, so anything after that transition is
skipped, like code after a `return`. Handlers, a transition to the state itself and a transition inside
`if` cut nothing.
