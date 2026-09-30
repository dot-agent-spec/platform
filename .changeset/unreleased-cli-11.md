---
"@dot-agent/cli": minor
---

`src/cli-args.ts` — argument parsing extracted into a side-effect-free module so it can be unit-tested without importing `cli.ts`, which runs `main()` on import by design. It also owns the `USAGE` map that both the per-command `--help` output and the top-level help block are built from.
