# Packing an agent

## Command

```
dot-agent pack <dir> --out <file.agent>
```

Produces a `.agent` zip archive containing the compiled bundle. The bundle includes the description, behavior (merged), soul, guides, knowledge files, and a manifest with a content hash.

## Example

```
dot-agent pack ./my-agent-dir --out my-agent.agent
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
manifest.json        <- id, name, domain, version, sha256
description          <- raw .description source
behavior             <- merged .behavior source
SOUL.md              <- persona (if present)
guides/
  guide-name.md
knowledge/
  topic.md
behaviors/
  extra.behavior
```

## Roundtrip check

```
dot-agent run ./my-agent-dir   # validate from source
dot-agent pack ./my-agent-dir --out agent.agent
dot-agent run agent.agent      # verify the archive loads correctly
```

## Notes

- Lint errors block pack (same as run)
- Warnings are printed but do not block
- `.agent` files are plain zip archives; `unzip -l agent.agent` to inspect
- Version in manifest is set to `dev` when built from a directory without a `version` field
