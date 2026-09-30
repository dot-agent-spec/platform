---
"@dot-agent/kernel-dsl": minor
---

**Resuming has a required order, and it emits effects the host must discard.** `restore_state` needs a loaded behavior, and `load_behavior` enters `init` and emits its entry effects — for a state the resumed session already left. The sequence is `load_behavior` → **drop the effects it returns** → `clear_memory` → `restore_state` → `set_memory` → `send_intent`.
