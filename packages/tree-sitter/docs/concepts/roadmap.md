# Roadmap & Open Questions

Future specification work and experimental features under evaluation.

## 1. Experimental Syntax

### Dynamic Parallelism (`each`)
Allows iterating a `run` statement over a collection, spawning tasks in parallel.
- **Syntax**: `run subagent "analyst" each context.files`
- **Status**: Defined in grammar; runtime semantics (accumulation, failure modes) pending.

## 2. Open Questions

- **HTTP/MCP Interfaces**: Formalizing how an agent exposes server endpoints.
- **Authorization Gates**: Stricter Human-in-the-loop (HITL) triggers separate from conversation.
- **Checkpointing**: Determining if state persistence should be implicit or directive-based.
- **Timeouts**: Defining temporal boundaries for tool and subagent execution.
- **Subagent Contracts**: Standardizing how subagent outputs are accessed by the parent flow.
