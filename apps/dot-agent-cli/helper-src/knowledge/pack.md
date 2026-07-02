# Packing an agent

## Command

```
dot-agent pack --dir <dir> --out <file.agent>
```

There is no positional directory argument — `--dir` is required (it silently falls back to the
current working directory otherwise). Produces a `.agent` zip archive containing the compiled
bundle: the description, merged behavior, soul, guides, knowledge files, and a manifest with a
content hash.

## Example

```
dot-agent pack --dir ./my-agent-dir --out my-agent.agent
# output: my-agent.agent (12.4 KB)
```

## Running a packed agent

```
dot-agent run my-agent.agent
dot-agent run my-agent.agent --mcp
dot-agent run my-agent.agent --mcp --mcp-transport http --mcp-port 3000
```

## File layout inside the archive

```
.agent/
  aboutme.json        <- id, name, domain, version, capabilities, requires, integrity (sha256, ...)
  files.json           <- index: description filename, behavior, behaviors[], guides[], knowledge[]
  types.json            <- optional, only present if the .description declares type blocks
<description-file>    <- raw .description source, original filename (e.g. agent.description)
agent.behavior         <- merged .behavior source
SOUL.md                <- persona (if present)
guides/
  guide-name.md
knowledge/
  topic.md
behaviors/
  extra.behavior        <- original source of each merged file, at its original relative path
```

## Roundtrip check

```
dot-agent run ./my-agent-dir              # validate from source
dot-agent pack --dir ./my-agent-dir --out agent.agent
dot-agent run agent.agent                 # verify the archive loads correctly
```

## Notes

- Lint errors block pack (same as run)
- Warnings are printed but do not block
- `.agent` files are plain zip archives; `unzip -l agent.agent` to inspect
- Version resolution: explicit `--version`, else `git describe --tags --abbrev=0` in the target
  repo, else the literal `v1.0.0`. It is never set to `dev`.
