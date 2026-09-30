---
"@dot-agent/cli": minor
---

`init`'s refusal to overwrite existing files names the override for the surface it reached: `--force` on the command line, the `force` parameter over MCP. The exported `init()` itself now throws with `err.code === 'INIT_COLLISION'` and an `err.collisions` list of the colliding relative paths, and no longer names either surface's override in its own message — each surface appends its own hint on seeing that code. The MCP tool `dot_agent_init` gained the `force` boolean parameter this required, and reports a collision as a normal `{ ok: false, reason }` result rather than failing the tool call ([#47](https://github.com/dot-agent-spec/platform/issues/47)).
