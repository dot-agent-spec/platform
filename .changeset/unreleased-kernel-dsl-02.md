---
"@dot-agent/kernel-dsl": minor
---

**The blob carries the behavior's identity, not just its shape.** `v` changes only when this crate changes, so on its own it would admit any blob whose state name happens to exist in the loaded FSM — one agent's position restoring into another that reuses the name, and (since `init` is mandatory and `ended` native) a position at either of those two restoring into literally any agent. `behavior` is a 16-hex-digit fingerprint of the loaded state graph — state names in declaration order, each state's intents and their transition targets, its offtopic handler, its `after N` thresholds — so a foreign or stale blob is refused with an error naming the mismatch. It fingerprints the *graph*, not the source text, so reformatting or a comment does not invalidate stored snapshots.
