---
"@dot-agent/sdk": minor
---

`start()` now throws on a session that was restored from a snapshot, and `restore()` throws on a session already started or restored. `snapshot()` throws before either, and after a `start()` whose behavior failed to parse (`start()` itself still reports that as a `parse_error` effect).
