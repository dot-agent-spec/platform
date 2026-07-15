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

## What gets packed: only what the behavior links

Guides and knowledge files are not swept out of their directories. A file is bundled only when a
`guide "x.md"` or `teach "x.md"` statement names it. Each reference resolves against its namespace
directory first (`guides/x.md`, `knowledge/x.md`), then against a file sitting loose next to the
`.behavior`; either way it lands under `guides/` or `knowledge/` in the archive.

- A reference that resolves to neither place fails with `E018`.
- A file in `guides/` or `knowledge/` that no statement names gets `W015` and is **left out** of the
  archive. That is intentional: at runtime the host only ever learns a filename from a `teach` effect,
  and there is no way to list the knowledge directory, so an unreferenced file is unreachable.
- Only `.md` and `.txt` count as file references. `teach "some prose"` stays inline literal text.

## Notes

- Lint errors block pack (same as run)
- Warnings are printed but do not block
- `.agent` files are plain zip archives; `unzip -l agent.agent` to inspect
- Version resolution: explicit `--version`, else `git describe --tags --abbrev=0` in the target
  repo, else the literal `v1.0.0`. It is never set to `dev`.
