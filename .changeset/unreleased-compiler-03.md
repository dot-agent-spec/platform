---
"@dot-agent/compiler": minor
---

**Breaking: `W016` is now `E022` and blocks `pack()`.** A `guide`/`teach` reference resolving outside `guides/`/`knowledge/` used to warn and still bundle the file; `pack` now refuses before writing the archive, naming the file, the reference and the namespace it must move to. Resolves [platform#9](https://github.com/dot-agent-spec/platform/issues/9).
