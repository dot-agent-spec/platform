---
"@dot-agent/kernel-dsl": minor
---

**`tick_prompt` saturates instead of overflowing.** The prompt counter is now restorable from host storage, so any `u32` can reach it. At `u32::MAX` the old `+= 1` aborted the module in debug (the workspace builds with `panic = "abort"`, so a host could not catch it) and wrapped to `0` in release, silently re-arming every `after N prompts` handler in the state. A saturated counter now sticks and fires nothing.
