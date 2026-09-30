---
"@dot-agent/cli": minor
---

`unpack`'s refusal to overwrite an existing output directory names the override for the surface it reached: `--force` on the command line, the `force` parameter over MCP, where `dot_agent_unpack` now reports it as a `{ ok: false, reason }` result rather than a tool error. The exported `unpack()` throws with `err.code === 'UNPACK_EXISTS'` and `err.dir`, and no override hint in its message ([#66](https://github.com/dot-agent-spec/platform/issues/66)).
