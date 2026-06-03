# Roadmap & Open Questions

Areas identified for future specification work and experimental features.

## 1. Experimental Syntax

### Dynamic parallelism — `each`
The current `parallel` block requires a statically known list of tasks. `each` iterates a run statement over a collection, spawning tasks in parallel:

```flow
run subagent "reviewer" each context.files
on complete
  set worksession.reviews = results
  next review_summary
on failed
  next handle_review_error
```

The `each` modifier is defined in the grammar but its runtime semantics (result accumulation, partial failure handling) are still being specified.

## 2. Open Questions

**HTTP/MCP interface declaration:** If an agent is an MCP wrapper (like `figma.agent`), there is no formal syntax yet to declare that it exposes HTTP endpoints. Candidates under evaluation:
- Keyword `server` in the DSL (Layer 1)
- Attribute in Layer 2, inferred by static analysis of `capabilities`
- Explicit registration in the domain's `.well-known`

**Human-in-the-loop gate:** `interact` pauses the machine for conversational input. Some workflows need a stricter authorization gate — separate from conversation — before executing a dangerous tool.

**Checkpointing:** Whether checkpointing is implicit at every `next` transition or requires an explicit directive for long-running flows.

**Timeouts:** `.behavior` currently has no temporal boundary on tool or subagent execution. A stalled call hangs the machine indefinitely.

**Subagent return contract:** The convention for accessing subagent output is currently implicit and unspecified, creating ambiguity for compiler authors.
