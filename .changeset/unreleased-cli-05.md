---
"@dot-agent/cli": minor
---

**`init` rejects unknown options instead of discarding them.** Argument parsing was a loop that recognised `--name`, `--domain` and `--dir` and silently dropped everything else, so `dot-agent init --help` parsed as a bare `init` and scaffolded into the current directory. An unrecognised option, or a value flag with no value, now exits with the command's usage line. This also fixes `--dir=/tmp/x` (the equals form), which was previously discarded and scaffolded into the current directory instead.
