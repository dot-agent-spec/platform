---
"@dot-agent/cli": minor
---

**Breaking: `dot-agent init` refuses to write when any file it would create already exists.** It previously overwrote them without asking, so `init` run in a populated folder replaced that folder's `LICENSE`, `README.md` and `SOUL.md` with template copies ([#21](https://github.com/dot-agent-spec/platform/issues/21)). The whole template payload is now enumerated before the first byte lands, so a collision found part-way through no longer leaves earlier files already overwritten, and every colliding path is named in one message. Pass `--force` to restore the old overwriting behaviour. A script or CI step that relied on `init` clobbering an existing directory must now pass `--force` explicitly.
